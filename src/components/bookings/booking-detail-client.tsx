"use client";

// Fiche réservation branchée sur la couche de données (mode mock).
// Reprend la mise en page de l'ancienne version serveur : matériels,
// période, chronologie, client, tarification, paiement & caution.

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Mail, Phone } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import type { BookingWithRelations } from "@/lib/data/repositories";
import type { BookingStatusHistory } from "@/lib/types/database";
import {
  BOOKING_STATUS,
  CALENDAR_STATUS_COLORS,
  CUSTOMER_TYPE_LABELS,
  derivedBookingStatus,
} from "@/lib/core/labels";
import { isEditableStatus } from "@/lib/core/booking-status";
import {
  formatCustomerName,
  formatDateTime,
  formatInitials,
  formatMoney,
} from "@/lib/core/format";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BookingStatusBadge,
  DepositStatusBadge,
  PaymentStatusBadge,
} from "@/components/shared/status-badge";
import { BookingActions } from "@/components/bookings/booking-actions";
import { PaymentDepositControls } from "@/components/bookings/payment-deposit-controls";

type DetailData = {
  booking: BookingWithRelations | null;
  history: BookingStatusHistory[];
};

export function BookingDetailClient({ id }: { id: string }) {
  const { provider, organization, version } = useAppData();
  const [data, setData] = useState<DetailData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([provider.bookings.get(id), provider.bookings.history(id)]).then(
      ([booking, history]) => {
        if (!cancelled) setData({ booking, history });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [provider, version, id]);

  if (!data || !organization) {
    return (
      <div>
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!data.booking) {
    notFound();
  }

  const booking = data.booking;
  const tz = organization.timezone;
  const currency = organization.currency;
  const derived = derivedBookingStatus(booking.status, booking.end_at);
  const customer = booking.customer;
  const customerName = customer ? formatCustomerName(customer) : "—";

  // Chronologie : plus récent en haut ; repli sur la date de création si
  // l'historique est vide.
  const history = [...data.history].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div>
      <Link
        href="/bookings"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Réservations
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              {booking.booking_number}
            </h1>
            <BookingStatusBadge status={derived} />
            <PaymentStatusBadge status={booking.payment_status} />
            <DepositStatusBadge status={booking.deposit_status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Créée le {formatDateTime(booking.created_at, tz)}
          </p>
        </div>
        <BookingActions
          bookingId={booking.id}
          status={booking.status}
          editable={isEditableStatus(booking.status)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          {/* Matériels */}
          <Card>
            <CardHeader>
              <CardTitle>Matériels</CardTitle>
            </CardHeader>
            <CardContent>
              {booking.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun matériel sur cette réservation.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matériel</TableHead>
                      <TableHead className="text-right">Qté</TableHead>
                      <TableHead className="text-right">Prix / jour</TableHead>
                      <TableHead className="text-right">Jours</TableHead>
                      <TableHead className="text-right">Total ligne</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {booking.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.equipment?.name ?? "Matériel supprimé"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(item.daily_price, currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {booking.duration_days}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(item.line_total, currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4}>Sous-total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(booking.subtotal, currency)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Période */}
          <Card>
            <CardHeader>
              <CardTitle>Période</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {derived === "late" && (
                <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  Location en retard : le retour était prévu le{" "}
                  {formatDateTime(booking.end_at, tz)}.
                </p>
              )}
              <dl className="grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase">
                    Départ
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {formatDateTime(booking.start_at, tz)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase">
                    Retour
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {formatDateTime(booking.end_at, tz)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase">
                    Durée facturable
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {booking.duration_days} jour
                    {booking.duration_days > 1 ? "s" : ""}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Notes */}
          {booking.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-foreground">
                  {booking.notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Chronologie */}
          <Card>
            <CardHeader>
              <CardTitle>Chronologie</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative ml-1.5 space-y-4 border-l border-border pl-5">
                {history.map((event) => (
                  <li key={event.id} className="relative">
                    <span
                      className={cn(
                        "absolute top-1 -left-[26px] size-2.5 rounded-full ring-2 ring-card",
                        CALENDAR_STATUS_COLORS[event.to_status]
                      )}
                      aria-hidden
                    />
                    <p className="text-sm font-medium">
                      {event.from_status
                        ? `${BOOKING_STATUS[event.from_status].label} → ${BOOKING_STATUS[event.to_status].label}`
                        : `Création — ${BOOKING_STATUS[event.to_status].label}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.created_at, tz)}
                    </p>
                    {event.note && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {event.note}
                      </p>
                    )}
                  </li>
                ))}
                {history.length === 0 && (
                  <li className="relative">
                    <span
                      className="absolute top-1 -left-[26px] size-2.5 rounded-full bg-border ring-2 ring-card"
                      aria-hidden
                    />
                    <p className="text-sm font-medium">
                      Création de la réservation
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(booking.created_at, tz)}
                    </p>
                  </li>
                )}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Client */}
          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent>
              {customer ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-sm font-semibold text-white">
                      {formatInitials(customerName)}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="block truncate font-medium text-primary hover:text-primary/80 hover:underline"
                      >
                        {customerName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {CUSTOMER_TYPE_LABELS[customer.type]}
                      </p>
                    </div>
                  </div>
                  {(customer.phone || customer.email) && (
                    <div className="space-y-1.5 text-sm">
                      {customer.phone && (
                        <a
                          href={`tel:${customer.phone}`}
                          className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Phone
                            className="size-4 text-muted-foreground/70"
                            aria-hidden
                          />
                          {customer.phone}
                        </a>
                      )}
                      {customer.email && (
                        <a
                          href={`mailto:${customer.email}`}
                          className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Mail
                            className="size-4 text-muted-foreground/70"
                            aria-hidden
                          />
                          <span className="truncate">{customer.email}</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Client introuvable.</p>
              )}
            </CardContent>
          </Card>

          {/* Tarification */}
          <Card>
            <CardHeader>
              <CardTitle>Tarification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sous-total</span>
                <span className="tabular-nums">
                  {formatMoney(booking.subtotal, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Remise</span>
                <span className="tabular-nums">
                  {booking.discount_amount > 0
                    ? `− ${formatMoney(booking.discount_amount, currency)}`
                    : formatMoney(0, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Frais supplémentaires</span>
                <span className="tabular-nums">
                  {booking.extra_fees_amount > 0
                    ? `+ ${formatMoney(booking.extra_fees_amount, currency)}`
                    : formatMoney(0, currency)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-medium">Total</span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatMoney(booking.total_amount, currency)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Caution</span>
                <span className="font-medium tabular-nums">
                  {formatMoney(booking.deposit_amount, currency)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Paiement & caution */}
          <Card>
            <CardHeader>
              <CardTitle>Paiement &amp; caution</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentDepositControls
                bookingId={booking.id}
                paymentStatus={booking.payment_status}
                depositStatus={booking.deposit_status}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
