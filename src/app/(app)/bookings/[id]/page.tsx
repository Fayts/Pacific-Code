import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Mail, Phone } from "lucide-react";
import { requireOrgContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
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
import type {
  Booking,
  BookingItem,
  BookingStatusHistory,
  Customer,
} from "@/lib/types/database";

type BookingDetail = Booking & {
  customers: Customer | null;
  booking_items: (BookingItem & { equipment_items: { name: string } | null })[];
  booking_status_history: BookingStatusHistory[];
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireOrgContext();
  const { organization } = context;
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select(
      "*, customers(*), booking_items(*, equipment_items(name)), booking_status_history(*)"
    )
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (!data) notFound();
  const booking = data as unknown as BookingDetail;

  const tz = organization.timezone;
  const currency = organization.currency;
  const derived = derivedBookingStatus(booking.status, booking.end_at);
  const customer = booking.customers;
  const customerName = customer ? formatCustomerName(customer) : "—";

  // Chronologie : plus récent en haut ; repli sur la date de création si
  // l'historique est vide.
  const history = [...booking.booking_status_history].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div>
      <Link
        href="/bookings"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
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
          <p className="mt-1 text-sm text-neutral-500">
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
              {booking.booking_items.length === 0 ? (
                <p className="text-sm text-neutral-500">
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
                    {booking.booking_items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.equipment_items?.name ?? "Matériel supprimé"}
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
                <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
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
                  <dt className="text-xs font-medium text-neutral-500 uppercase">
                    Départ
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {formatDateTime(booking.start_at, tz)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-neutral-500 uppercase">
                    Retour
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {formatDateTime(booking.end_at, tz)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-neutral-500 uppercase">
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
                <p className="text-sm whitespace-pre-wrap text-neutral-700">
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
              <ol className="relative ml-1.5 space-y-4 border-l border-neutral-200 pl-5">
                {history.map((event) => (
                  <li key={event.id} className="relative">
                    <span
                      className={cn(
                        "absolute top-1 -left-[26px] size-2.5 rounded-full ring-2 ring-white",
                        CALENDAR_STATUS_COLORS[event.to_status]
                      )}
                      aria-hidden
                    />
                    <p className="text-sm font-medium">
                      {event.from_status
                        ? `${BOOKING_STATUS[event.from_status].label} → ${BOOKING_STATUS[event.to_status].label}`
                        : `Création — ${BOOKING_STATUS[event.to_status].label}`}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDateTime(event.created_at, tz)}
                    </p>
                    {event.note && (
                      <p className="mt-0.5 text-sm text-neutral-600">
                        {event.note}
                      </p>
                    )}
                  </li>
                ))}
                {history.length === 0 && (
                  <li className="relative">
                    <span
                      className="absolute top-1 -left-[26px] size-2.5 rounded-full bg-neutral-300 ring-2 ring-white"
                      aria-hidden
                    />
                    <p className="text-sm font-medium">
                      Création de la réservation
                    </p>
                    <p className="text-xs text-neutral-500">
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
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sm font-semibold text-sky-800">
                      {formatInitials(customerName)}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="block truncate font-medium text-sky-700 hover:underline"
                      >
                        {customerName}
                      </Link>
                      <p className="text-xs text-neutral-500">
                        {CUSTOMER_TYPE_LABELS[customer.type]}
                      </p>
                    </div>
                  </div>
                  {(customer.phone || customer.email) && (
                    <div className="space-y-1.5 text-sm">
                      {customer.phone && (
                        <a
                          href={`tel:${customer.phone}`}
                          className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900"
                        >
                          <Phone
                            className="size-4 text-neutral-400"
                            aria-hidden
                          />
                          {customer.phone}
                        </a>
                      )}
                      {customer.email && (
                        <a
                          href={`mailto:${customer.email}`}
                          className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900"
                        >
                          <Mail
                            className="size-4 text-neutral-400"
                            aria-hidden
                          />
                          <span className="truncate">{customer.email}</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">Client introuvable.</p>
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
                <span className="text-neutral-500">Sous-total</span>
                <span className="tabular-nums">
                  {formatMoney(booking.subtotal, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Remise</span>
                <span className="tabular-nums">
                  {booking.discount_amount > 0
                    ? `− ${formatMoney(booking.discount_amount, currency)}`
                    : formatMoney(0, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Frais supplémentaires</span>
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
                <span className="text-neutral-500">Caution</span>
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
