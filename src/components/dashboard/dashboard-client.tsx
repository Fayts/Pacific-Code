"use client";

// Tableau de bord branché sur la couche de données (mode mock).
// Toute la logique de calcul reprend celle de la version serveur :
// mêmes définitions de « départ du jour », « retour », « en retard »,
// « réservé / en location » que le reste de l'application.

import { useEffect, useState } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import type { BookingWithRelations } from "@/lib/data/repositories";
import type { Customer, EquipmentItem } from "@/lib/types/database";
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
import { ImportHeaderAction } from "@/components/dashboard/import-header-action";
import { ActivationScreen } from "@/components/dashboard/activation-screen";
import {
  computeOnboardingProgress,
  isBusinessUnconfigured,
} from "@/lib/core/onboarding";
import DashboardLoading from "@/app/(app)/dashboard/loading";

const MAX_OPERATIONS = 8;
const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const BLOCKING = ["pending", "confirmed", "in_progress"] as const;

type DashboardData = {
  bookings: BookingWithRelations[];
  equipment: EquipmentItem[];
  customers: Customer[];
};

export function DashboardClient() {
  const { provider, session, organization, version } = useAppData();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      provider.bookings.list(),
      provider.equipment.list({ includeArchived: true }),
      provider.customers.list({ includeArchived: true }),
    ]).then(([bookings, equipment, customers]) => {
      if (!cancelled) setData({ bookings, equipment, customers });
    });
    return () => {
      cancelled = true;
    };
  }, [provider, version]);

  if (!data || !organization) {
    return <DashboardLoading />;
  }

  const org = organization;
  const now = new Date();
  const day = dayRangeInTimeZone(now, org.timezone);
  const month = monthRangeInTimeZone(now, org.timezone);

  const { bookings, equipment, customers } = data;

  // Espace non configuré : l'activation (import express) remplace le
  // dashboard tant que rien n'existe et que l'onboarding n'est pas terminé.
  if (isBusinessUnconfigured(org, equipment, customers, bookings.length)) {
    return (
      <ActivationScreen
        progress={computeOnboardingProgress(org, equipment, customers)}
      />
    );
  }

  const activeBookings = bookings
    .filter((b) => (BLOCKING as readonly string[]).includes(b.status))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  // ----- Cartes de synthèse -----

  const departuresToday = activeBookings.filter((b) => {
    const start = new Date(b.start_at);
    return start >= day.start && start < day.end;
  }).length;

  const inProgress = activeBookings.filter((b) => b.status === "in_progress");

  const completedToday = bookings.filter((b) => {
    if (b.status !== "completed") return false;
    // Date effective du retour (completed_at) ; end_at n'est qu'un prévisionnel.
    const end = new Date(b.completed_at ?? b.end_at);
    return end >= day.start && end < day.end;
  }).length;

  const returnsToday =
    inProgress.filter((b) => {
      const end = new Date(b.end_at);
      return end >= day.start && end < day.end;
    }).length + completedToday;

  const lateBookings = inProgress.filter((b) => new Date(b.end_at) < now);

  const monthRevenue = bookings
    .filter(
      (b) =>
        ["pending", "confirmed", "in_progress", "completed"].includes(b.status) &&
        new Date(b.start_at) >= month.start &&
        new Date(b.start_at) < month.end
    )
    .reduce((sum, b) => sum + (b.total_amount ?? 0), 0);

  const activeEquipment = equipment.filter((e) => !e.archived_at);
  const unavailableEquipmentCount = activeEquipment.filter(
    (e) => e.status === "maintenance" || e.status === "unavailable"
  ).length;

  // ----- Résumé du parc : charges actuelles par matériel -----

  const loads = new Map<string, EquipmentBookingLoad>();
  for (const booking of activeBookings) {
    if (new Date(booking.start_at) > now) continue;
    for (const item of booking.items) {
      const entry = loads.get(item.equipment_id) ?? {
        rentedNow: 0,
        reservedNow: 0,
      };
      if (booking.status === "in_progress") {
        // Sorti, y compris en retard : le matériel n'est pas revenu.
        entry.rentedNow += item.quantity;
      } else if (new Date(booking.end_at) > now) {
        entry.reservedNow += item.quantity;
      }
      loads.set(item.equipment_id, entry);
    }
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
    booking: BookingWithRelations,
    kind: DashboardOperation["kind"],
    at: Date
  ): DashboardOperation => ({
    key: `${kind}-${booking.id}`,
    kind,
    bookingId: booking.id,
    bookingNumber: booking.booking_number,
    customerName: booking.customer
      ? formatCustomerName(booking.customer)
      : "Client inconnu",
    equipmentSummary: booking.items
      .map((item) => {
        const name = item.equipment?.name ?? "Matériel";
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
    } else if (start < now) {
      // Départ prévu déjà dépassé (matériel pas encore parti) : opération
      // la plus urgente de l'écran, elle ne doit surtout pas disparaître.
      lateOps.push(toOperation(booking, "late_departure", start));
    } else if (start < horizon) {
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

  const firstName = session?.user.firstName?.trim();
  const dateLabel = formatDateLong(now, org.timezone);
  const dateSubtitle = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

  return (
    <div>
      <PageHeader
        title={firstName ? `Bonjour ${firstName}` : "Bonjour"}
        description={dateSubtitle}
        actions={
          <ImportHeaderAction
            configured={org.onboarding_completed_at !== null}
          />
        }
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
            <UpcomingOperations operations={operations} timezone={org.timezone} />
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
