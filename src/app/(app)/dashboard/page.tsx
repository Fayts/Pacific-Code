import type { Metadata } from "next";
import { requireOrgContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { dayRangeInTimeZone, monthRangeInTimeZone } from "@/lib/core/dates";
import {
  formatCustomerName,
  formatDateLong,
  formatMoney,
} from "@/lib/core/format";
import { derivedBookingStatus } from "@/lib/core/labels";
import {
  computeEquipmentDisplay,
  type EquipmentBookingLoad,
} from "@/lib/core/equipment";
import { PageHeader } from "@/components/shared/page-header";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import {
  UpcomingOperations,
  type DashboardOperation,
} from "@/components/dashboard/upcoming-operations";
import {
  FleetSummary,
  type FleetCounts,
} from "@/components/dashboard/fleet-summary";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { WelcomeScreen } from "@/components/dashboard/welcome";

export const metadata: Metadata = {
  title: "Tableau de bord",
};

const MAX_OPERATIONS = 8;
const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export default async function DashboardPage() {
  const context = await requireOrgContext();
  const org = context.organization;
  const supabase = await createClient();

  const now = new Date();
  const nowIso = now.toISOString();
  const day = dayRangeInTimeZone(now, org.timezone);
  const month = monthRangeInTimeZone(now, org.timezone);

  const [
    activeBookingsRes,
    completedTodayRes,
    monthBookingsRes,
    equipmentRes,
    loadRes,
    customersCountRes,
    bookingsCountRes,
  ] = await Promise.all([
    // Réservations actives : cartes, retards et liste des prochaines opérations.
    supabase
      .from("bookings")
      .select(
        "id, booking_number, status, start_at, end_at, customers(type, first_name, last_name, company_name), booking_items(quantity, equipment_items(name))"
      )
      .eq("organization_id", org.id)
      .in("status", ["pending", "confirmed", "in_progress"])
      .order("start_at", { ascending: true }),
    // Retours déjà clôturés aujourd'hui.
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .eq("status", "completed")
      .gte("end_at", day.start.toISOString())
      .lt("end_at", day.end.toISOString()),
    // CA estimé du mois : réservations démarrant ce mois-ci, hors brouillons/annulées.
    supabase
      .from("bookings")
      .select("total_amount")
      .eq("organization_id", org.id)
      .in("status", ["pending", "confirmed", "in_progress", "completed"])
      .gte("start_at", month.start.toISOString())
      .lt("start_at", month.end.toISOString()),
    // Parc complet (l'archivage est filtré côté code pour l'état vide global).
    supabase
      .from("equipment_items")
      .select("id, status, quantity_total, archived_at")
      .eq("organization_id", org.id),
    // Charges actuelles du parc : lignes des réservations actives déjà commencées.
    supabase
      .from("booking_items")
      .select("equipment_id, quantity, bookings!inner(status, start_at, end_at)")
      .eq("organization_id", org.id)
      .in("bookings.status", ["pending", "confirmed", "in_progress"])
      .lte("bookings.start_at", nowIso),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id),
  ]);

  const activeBookings = activeBookingsRes.data ?? [];
  const equipment = equipmentRes.data ?? [];
  const loadRows = loadRes.data ?? [];

  // État vide global : organisation sans matériel, client ni réservation.
  const isEmptyOrganization =
    equipment.length === 0 &&
    (customersCountRes.count ?? 0) === 0 &&
    (bookingsCountRes.count ?? 0) === 0;

  const firstName = context.profile?.first_name?.trim();
  const dateLabel = formatDateLong(now, org.timezone);
  const dateSubtitle = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

  if (isEmptyOrganization) {
    return <WelcomeScreen />;
  }

  // ----- Cartes de synthèse -----

  const departuresToday = activeBookings.filter((b) => {
    const start = new Date(b.start_at);
    return start >= day.start && start < day.end;
  }).length;

  const inProgress = activeBookings.filter((b) => b.status === "in_progress");

  const returnsToday =
    inProgress.filter((b) => {
      const end = new Date(b.end_at);
      return end >= day.start && end < day.end;
    }).length + (completedTodayRes.count ?? 0);

  const lateBookings = inProgress.filter((b) => new Date(b.end_at) < now);

  const monthRevenue = (monthBookingsRes.data ?? []).reduce(
    (sum, b) => sum + (b.total_amount ?? 0),
    0
  );

  const activeEquipment = equipment.filter((e) => !e.archived_at);
  const unavailableEquipmentCount = activeEquipment.filter(
    (e) => e.status === "maintenance" || e.status === "unavailable"
  ).length;

  // ----- Résumé du parc : charges actuelles par matériel -----

  const loads = new Map<string, EquipmentBookingLoad>();
  for (const row of loadRows) {
    const booking = row.bookings;
    if (!booking) continue;
    const entry = loads.get(row.equipment_id) ?? {
      rentedNow: 0,
      reservedNow: 0,
    };
    if (booking.status === "in_progress") {
      // Sorti, y compris en retard : le matériel n'est pas revenu.
      entry.rentedNow += row.quantity;
    } else if (new Date(booking.end_at) > now) {
      entry.reservedNow += row.quantity;
    }
    loads.set(row.equipment_id, entry);
  }

  const fleetCounts: FleetCounts = {
    total: activeEquipment.length,
    available: 0,
    reserved: 0,
    rented: 0,
    maintenance: 0,
    unavailable: 0,
  };
  for (const item of activeEquipment) {
    const display = computeEquipmentDisplay(
      item,
      loads.get(item.id) ?? { rentedNow: 0, reservedNow: 0 }
    );
    if (display.status !== "archived") {
      fleetCounts[display.status] += 1;
    }
  }

  // ----- Prochaines opérations -----

  const horizon = new Date(now.getTime() + UPCOMING_WINDOW_MS);

  const toOperation = (
    booking: (typeof activeBookings)[number],
    kind: DashboardOperation["kind"],
    at: Date
  ): DashboardOperation => ({
    key: `${kind}-${booking.id}`,
    kind,
    bookingId: booking.id,
    bookingNumber: booking.booking_number,
    customerName: booking.customers
      ? formatCustomerName(booking.customers)
      : "Client inconnu",
    equipmentSummary: booking.booking_items
      .map((item) => {
        const name = item.equipment_items?.name ?? "Matériel";
        return item.quantity > 1 ? `${item.quantity}× ${name}` : name;
      })
      .join(", "),
    at: at.toISOString(),
    status: derivedBookingStatus(booking.status, booking.end_at, now),
  });

  const lateOps: DashboardOperation[] = [];
  const upcomingOps: DashboardOperation[] = [];

  for (const booking of activeBookings) {
    const start = new Date(booking.start_at);
    const end = new Date(booking.end_at);

    if (booking.status === "in_progress") {
      if (end < now) {
        lateOps.push(toOperation(booking, "late", end));
      } else {
        upcomingOps.push(toOperation(booking, "return", end));
      }
    } else if (start >= now && start < horizon) {
      // Départ à venir sous 7 jours (confirmé ou à confirmer).
      upcomingOps.push(toOperation(booking, "departure", start));
    } else if (booking.status === "pending") {
      upcomingOps.push(toOperation(booking, "to_confirm", start));
    }
  }

  const byDate = (a: DashboardOperation, b: DashboardOperation) =>
    a.at.localeCompare(b.at);
  const operations = [
    ...lateOps.sort(byDate),
    ...upcomingOps.sort(byDate),
  ].slice(0, MAX_OPERATIONS);

  return (
    <div>
      <PageHeader
        title={firstName ? `Bonjour ${firstName}` : "Bonjour"}
        description={dateSubtitle}
      />

      <div className="space-y-4">
        <SummaryCards
          departuresToday={departuresToday}
          returnsToday={returnsToday}
          inProgressCount={inProgress.length}
          lateCount={lateBookings.length}
          monthRevenue={formatMoney(monthRevenue, org.currency)}
          unavailableEquipmentCount={unavailableEquipmentCount}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <UpcomingOperations
              operations={operations}
              timezone={org.timezone}
            />
          </div>
          <div className="space-y-4">
            <QuickActions />
            <FleetSummary counts={fleetCounts} />
          </div>
        </div>
      </div>
    </div>
  );
}
