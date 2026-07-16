import Link from "next/link";
import { CalendarPlus, Plus, SearchX } from "lucide-react";
import { requireOrgContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { derivedBookingStatus } from "@/lib/core/labels";
import {
  formatCustomerName,
  formatDateTime,
  formatMoney,
} from "@/lib/core/format";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  BookingStatusBadge,
  DepositStatusBadge,
  PaymentStatusBadge,
} from "@/components/shared/status-badge";
import { BookingsFilters } from "@/components/bookings/bookings-filters";
import type {
  Booking,
  BookingItem,
  BookingStatus,
  Customer,
} from "@/lib/types/database";

type BookingListRow = Booking & {
  customers: Customer | null;
  booking_items: (BookingItem & { equipment_items: { name: string } | null })[];
};

const DB_STATUSES: BookingStatus[] = [
  "draft",
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; period?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const q = sp.q ?? "";
  const period = sp.period ?? "";

  const context = await requireOrgContext();
  const { organization } = context;
  const supabase = await createClient();

  const now = new Date();
  const nowIso = now.toISOString();

  let query = supabase
    .from("bookings")
    .select("*, customers(*), booking_items(*, equipment_items(name))")
    .eq("organization_id", organization.id)
    .order("start_at", { ascending: false });

  if (status === "late") {
    query = query.eq("status", "in_progress").lt("end_at", nowIso);
  } else if (DB_STATUSES.includes(status as BookingStatus)) {
    query = query.eq("status", status as BookingStatus);
  }

  if (period === "upcoming") {
    query = query.gt("start_at", nowIso);
  } else if (period === "current") {
    query = query.lte("start_at", nowIso).gte("end_at", nowIso);
  } else if (period === "past") {
    query = query.lt("end_at", nowIso);
  }

  const { data } = await query;
  let bookings = (data ?? []) as unknown as BookingListRow[];

  // Recherche : numéro de réservation ou nom du client.
  const needle = q.trim().toLowerCase();
  if (needle) {
    bookings = bookings.filter((booking) => {
      const number = booking.booking_number.toLowerCase();
      const customerName = booking.customers
        ? formatCustomerName(booking.customers).toLowerCase()
        : "";
      return number.includes(needle) || customerName.includes(needle);
    });
  }

  const hasFilters = Boolean(status || needle || period);
  const tz = organization.timezone;
  const currency = organization.currency;

  return (
    <div>
      <PageHeader
        title="Réservations"
        description="Suivez et gérez toutes vos locations."
        actions={
          <Button render={<Link href="/bookings/new" />}>
            <Plus aria-hidden />
            Nouvelle réservation
          </Button>
        }
      />

      <div className="space-y-4">
        <BookingsFilters status={status} q={q} period={period} />

        {bookings.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="Aucune réservation ne correspond"
              description="Modifiez votre recherche ou vos filtres pour retrouver vos réservations."
              action={
                <Button variant="outline" render={<Link href="/bookings" />}>
                  Réinitialiser les filtres
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={CalendarPlus}
              title="Aucune réservation pour le moment"
              description="Créez votre première réservation : elle apparaîtra ici et dans le calendrier."
              action={
                <Button render={<Link href="/bookings/new" />}>
                  <Plus aria-hidden />
                  Nouvelle réservation
                </Button>
              }
            />
          )
        ) : (
          <>
            {/* Tableau (desktop) */}
            <div className="hidden overflow-hidden rounded-xl bg-white ring-1 ring-foreground/10 md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50/60 hover:bg-neutral-50/60">
                    <TableHead>Numéro</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Matériels</TableHead>
                    <TableHead>Départ</TableHead>
                    <TableHead>Retour</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead>Caution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => {
                    const derived = derivedBookingStatus(
                      booking.status,
                      booking.end_at,
                      now
                    );
                    const equipmentNames = booking.booking_items
                      .map(
                        (item) =>
                          item.equipment_items?.name ?? "Matériel supprimé"
                      )
                      .join(", ");
                    return (
                      <TableRow key={booking.id}>
                        <TableCell>
                          <Link
                            href={`/bookings/${booking.id}`}
                            className="font-medium text-sky-700 hover:underline"
                          >
                            {booking.booking_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {booking.customers
                            ? formatCustomerName(booking.customers)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <span
                            className="block max-w-48 truncate text-neutral-600"
                            title={equipmentNames}
                          >
                            {equipmentNames || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-neutral-600">
                          {formatDateTime(booking.start_at, tz)}
                        </TableCell>
                        <TableCell className="text-neutral-600">
                          {formatDateTime(booking.end_at, tz)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(booking.total_amount, currency)}
                        </TableCell>
                        <TableCell>
                          <BookingStatusBadge status={derived} />
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={booking.payment_status} />
                        </TableCell>
                        <TableCell>
                          <DepositStatusBadge status={booking.deposit_status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Cartes empilées (mobile) */}
            <ul className="space-y-2 md:hidden">
              {bookings.map((booking) => {
                const derived = derivedBookingStatus(
                  booking.status,
                  booking.end_at,
                  now
                );
                const equipmentNames = booking.booking_items
                  .map(
                    (item) => item.equipment_items?.name ?? "Matériel supprimé"
                  )
                  .join(", ");
                return (
                  <li key={booking.id}>
                    <Link
                      href={`/bookings/${booking.id}`}
                      className="block rounded-xl bg-white p-4 ring-1 ring-foreground/10 transition-colors hover:bg-neutral-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sky-700">
                          {booking.booking_number}
                        </span>
                        <BookingStatusBadge status={derived} />
                      </div>
                      <p className="mt-1 text-sm font-medium">
                        {booking.customers
                          ? formatCustomerName(booking.customers)
                          : "—"}
                      </p>
                      {equipmentNames && (
                        <p className="truncate text-sm text-neutral-500">
                          {equipmentNames}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-neutral-600">
                        {formatDateTime(booking.start_at, tz)}
                        {" → "}
                        {formatDateTime(booking.end_at, tz)}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-semibold tabular-nums">
                          {formatMoney(booking.total_amount, currency)}
                        </span>
                        <span className="flex gap-1.5">
                          <PaymentStatusBadge status={booking.payment_status} />
                          <DepositStatusBadge status={booking.deposit_status} />
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <p className="text-sm text-neutral-500">
              {bookings.length} réservation{bookings.length > 1 ? "s" : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
