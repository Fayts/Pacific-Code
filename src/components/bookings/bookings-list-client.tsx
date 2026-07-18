"use client";

// Liste des réservations branchée sur la couche de données (mode mock).
// Filtres statut/période et recherche sont appliqués côté client —
// mêmes règles que l'ancienne version serveur (« en retard » = en cours
// avec retour dépassé).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarPlus, Plus, SearchX } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import type { BookingWithRelations } from "@/lib/data/repositories";
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
import type { BookingStatus } from "@/lib/types/database";
import BookingsLoading from "@/app/(app)/bookings/loading";

const DB_STATUSES: BookingStatus[] = [
  "draft",
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

export function BookingsListClient() {
  const { provider, organization, version } = useAppData();
  const searchParams = useSearchParams();
  const [allBookings, setAllBookings] = useState<BookingWithRelations[] | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    provider.bookings.list().then((bookings) => {
      if (!cancelled) setAllBookings(bookings);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, version]);

  if (!allBookings || !organization) {
    return <BookingsLoading />;
  }

  const status = searchParams.get("status") ?? "";
  const q = searchParams.get("q") ?? "";
  const period = searchParams.get("period") ?? "";

  const now = new Date();

  let bookings = allBookings
    .slice()
    .sort((a, b) => b.start_at.localeCompare(a.start_at));

  if (status === "late") {
    bookings = bookings.filter(
      (b) => b.status === "in_progress" && new Date(b.end_at) < now
    );
  } else if (DB_STATUSES.includes(status as BookingStatus)) {
    bookings = bookings.filter((b) => b.status === status);
  }

  if (period === "upcoming") {
    bookings = bookings.filter((b) => new Date(b.start_at) > now);
  } else if (period === "current") {
    bookings = bookings.filter(
      (b) => new Date(b.start_at) <= now && new Date(b.end_at) >= now
    );
  } else if (period === "past") {
    bookings = bookings.filter((b) => new Date(b.end_at) < now);
  }

  // Recherche : numéro de réservation ou nom du client.
  const needle = q.trim().toLowerCase();
  if (needle) {
    bookings = bookings.filter((booking) => {
      const number = booking.booking_number.toLowerCase();
      const customerName = booking.customer
        ? formatCustomerName(booking.customer).toLowerCase()
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
                    const equipmentNames = booking.items
                      .map((item) => item.equipment?.name ?? "Matériel supprimé")
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
                          {booking.customer
                            ? formatCustomerName(booking.customer)
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
                const equipmentNames = booking.items
                  .map((item) => item.equipment?.name ?? "Matériel supprimé")
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
                        {booking.customer
                          ? formatCustomerName(booking.customer)
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
