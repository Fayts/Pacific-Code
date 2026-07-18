"use client";

// Fiche client branchée sur la couche de données (mode mock).
// Chiffres clés et historique sont recalculés à partir des repositories —
// mêmes règles que l'ancienne version serveur.

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, CalendarPlus, Pencil } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import type { BookingWithRelations } from "@/lib/data/repositories";
import type { Customer } from "@/lib/types/database";
import {
  formatCustomerName,
  formatDate,
  formatMoney,
} from "@/lib/core/format";
import { derivedBookingStatus } from "@/lib/core/labels";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { BookingStatusBadge } from "@/components/shared/status-badge";
import { CustomerActions } from "@/components/customers/customer-actions";
import { CustomerTypeBadge } from "@/components/customers/customer-type-badge";
import { Skeleton } from "@/components/ui/skeleton";

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-neutral-900">{children}</dd>
    </div>
  );
}

type DetailData = {
  customer: Customer | null;
  bookings: BookingWithRelations[];
};

export function CustomerDetailClient({ id }: { id: string }) {
  const { provider, organization, version } = useAppData();
  const [data, setData] = useState<DetailData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([provider.customers.get(id), provider.bookings.list()]).then(
      ([customer, bookings]) => {
        if (!cancelled) setData({ customer, bookings });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [provider, version, id]);

  if (!data || !organization) {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-44" />
          </div>
        </div>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data.customer) {
    notFound();
  }

  const customer = data.customer;
  const { currency, timezone } = organization;

  const bookings = data.bookings
    .filter((b) => b.customer_id === customer.id)
    .sort((a, b) => b.start_at.localeCompare(a.start_at));
  const name = formatCustomerName(customer);
  const archived = Boolean(customer.archived_at);

  // Chiffres clés dérivés des réservations.
  const totalSpent = bookings
    .filter((b) => b.status !== "cancelled" && b.status !== "draft")
    .reduce((sum, b) => sum + b.total_amount, 0);
  const inProgressCount = bookings.filter(
    (b) => b.status === "in_progress"
  ).length;

  const history = bookings.map((booking) => ({
    ...booking,
    displayStatus: derivedBookingStatus(booking.status, booking.end_at),
    materials:
      booking.items
        .map((item) => {
          const equipmentName = item.equipment?.name ?? "Matériel supprimé";
          return item.quantity > 1
            ? `${equipmentName} ×${item.quantity}`
            : equipmentName;
        })
        .join(", ") || "—",
  }));

  const stats = [
    { label: "Total dépensé", value: formatMoney(totalSpent, currency) },
    { label: "Réservations", value: String(bookings.length) },
    { label: "Locations en cours", value: String(inProgressCount) },
  ];

  return (
    <div>
      {/* En-tête */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              {name}
            </h1>
            <CustomerTypeBadge type={customer.type} />
            {archived && (
              <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                Archivé
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Client depuis le {formatDate(customer.created_at, timezone)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            render={<Link href={`/customers/${customer.id}/edit`} />}
          >
            <Pencil aria-hidden />
            Modifier
          </Button>
          {!archived && (
            <Button
              render={<Link href={`/bookings/new?customer=${customer.id}`} />}
            >
              <CalendarPlus aria-hidden />
              Nouvelle réservation
            </Button>
          )}
          <CustomerActions
            customerId={customer.id}
            customerName={name}
            archived={archived}
          />
        </div>
      </div>

      {archived && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Ce client est archivé : il n&apos;apparaît plus dans la liste des
          clients et ne peut plus recevoir de nouvelles réservations.
        </p>
      )}

      {/* Chiffres clés */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3"
          >
            <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
              {stat.label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Historique des réservations */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">
            Historique des réservations
          </h2>

          {history.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Aucune réservation"
              description="Ce client n'a pas encore de réservation."
              action={
                !archived ? (
                  <Button
                    render={
                      <Link href={`/bookings/new?customer=${customer.id}`} />
                    }
                  >
                    <CalendarPlus aria-hidden />
                    Nouvelle réservation
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {/* Tableau (desktop) */}
              <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-neutral-50/60">
                      <TableHead className="pl-4">Numéro</TableHead>
                      <TableHead>Matériels</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="pr-4">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="pl-4">
                          <Link
                            href={`/bookings/${booking.id}`}
                            className="font-medium text-sky-700 hover:underline"
                          >
                            {booking.booking_number}
                          </Link>
                        </TableCell>
                        <TableCell
                          className="max-w-56 truncate text-neutral-600"
                          title={booking.materials}
                        >
                          {booking.materials}
                        </TableCell>
                        <TableCell className="text-neutral-600">
                          {formatDate(booking.start_at, timezone)} →{" "}
                          {formatDate(booking.end_at, timezone)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(booking.total_amount, currency)}
                        </TableCell>
                        <TableCell className="pr-4">
                          <BookingStatusBadge status={booking.displayStatus} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Cartes empilées (mobile) */}
              <div className="space-y-3 md:hidden">
                {history.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/bookings/${booking.id}`}
                    className="block rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sky-700">
                        {booking.booking_number}
                      </span>
                      <BookingStatusBadge status={booking.displayStatus} />
                    </div>
                    <p className="mt-1 truncate text-sm text-neutral-600">
                      {booking.materials}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-neutral-500">
                        {formatDate(booking.start_at, timezone)} →{" "}
                        {formatDate(booking.end_at, timezone)}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatMoney(booking.total_amount, currency)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Coordonnées + notes */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Coordonnées</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                {customer.type === "company" && customer.company_name && (
                  <InfoRow label="Société">{customer.company_name}</InfoRow>
                )}
                {(customer.first_name || customer.last_name) && (
                  <InfoRow
                    label={customer.type === "company" ? "Contact" : "Nom"}
                  >
                    {[customer.first_name, customer.last_name]
                      .filter(Boolean)
                      .join(" ")}
                  </InfoRow>
                )}
                <InfoRow label="Email">
                  {customer.email ? (
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-sky-700 hover:underline"
                    >
                      {customer.email}
                    </a>
                  ) : (
                    <span className="text-neutral-400">Non renseigné</span>
                  )}
                </InfoRow>
                <InfoRow label="Téléphone">
                  {customer.phone ? (
                    <a
                      href={`tel:${customer.phone}`}
                      className="text-sky-700 hover:underline"
                    >
                      {customer.phone}
                    </a>
                  ) : (
                    <span className="text-neutral-400">Non renseigné</span>
                  )}
                </InfoRow>
                <InfoRow label="Adresse">
                  {customer.address ? (
                    <span className="whitespace-pre-line">
                      {customer.address}
                    </span>
                  ) : (
                    <span className="text-neutral-400">Non renseignée</span>
                  )}
                </InfoRow>
                {customer.id_number && (
                  <InfoRow label="N° d'identification">
                    {customer.id_number}
                  </InfoRow>
                )}
              </dl>
            </CardContent>
          </Card>

          {customer.internal_notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes internes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line text-neutral-700">
                  {customer.internal_notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
