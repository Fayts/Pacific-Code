import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  MapPin,
  MessageSquareText,
  Phone,
  UserRound,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/shell";
import { PaymentBadge, StatusBadge } from "@/components/admin/booking-bits";
import { Button, Card } from "@/components/ui";
import { BOOKINGS, getBooking, getCustomer, getItem } from "@/lib/data";
import { formatDate, formatXPF } from "@/lib/format";

export function generateStaticParams() {
  return BOOKINGS.map((b) => ({ id: b.id }));
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const booking = getBooking(id);
  if (!booking) notFound();

  const customer = getCustomer(booking.customerId)!;
  const item = getItem(booking.itemSlug)!;

  return (
    <>
      <Link
        href="/admin/reservations"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-800"
      >
        <ArrowLeft size={15} /> Retour aux réservations
      </Link>

      <AdminPageHeader
        title={`Réservation ${booking.reference}`}
        description={`Créée le ${formatDate(booking.createdAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">Modifier</Button>
            <Button variant="accent" size="sm">Confirmer</Button>
            <Button variant="danger" size="sm">Annuler</Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Détails de la réservation */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge status={booking.status} />
            <PaymentBadge status={booking.paymentStatus} />
          </div>

          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <CalendarDays size={18} className="mt-0.5 shrink-0 text-lagoon-600" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-navy-400">
                  Date & créneau
                </dt>
                <dd className="mt-1 text-sm font-medium text-navy-900">
                  {formatDate(booking.date)}
                  {booking.endDate ? ` → ${formatDate(booking.endDate)}` : ""}
                  <span className="block text-navy-500">{booking.timeSlot}</span>
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-lagoon-600" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-navy-400">
                  {booking.mode === "livraison" ? "Livraison" : "Retrait"}
                </dt>
                <dd className="mt-1 text-sm font-medium text-navy-900">
                  {booking.mode === "livraison" ? (
                    <>
                      {booking.commune}
                      <span className="block text-navy-500">{booking.address}</span>
                    </>
                  ) : (
                    "Au dépôt — Papeete"
                  )}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CreditCard size={18} className="mt-0.5 shrink-0 text-lagoon-600" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-navy-400">
                  Paiement
                </dt>
                <dd className="mt-1 text-sm font-medium text-navy-900">
                  {booking.paymentMethod}
                </dd>
              </div>
            </div>

            {booking.notes ? (
              <div className="flex items-start gap-3">
                <MessageSquareText size={18} className="mt-0.5 shrink-0 text-lagoon-600" />
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-navy-400">
                    Remarques
                  </dt>
                  <dd className="mt-1 text-sm text-navy-700">{booking.notes}</dd>
                </div>
              </div>
            ) : null}
          </dl>

          {/* Détail financier */}
          <div className="mt-7 rounded-2xl bg-mist-50 p-5">
            <p className="text-sm font-semibold text-navy-900">{item.name}</p>
            <div className="mt-3 space-y-1.5 text-sm text-navy-600">
              <div className="flex justify-between">
                <span>
                  {item.category === "location" ? "Location" : "Prestation"}{" "}
                  {item.priceUnit}
                </span>
                <span>{formatXPF(booking.itemPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span>Livraison</span>
                <span>
                  {booking.deliveryFee === 0
                    ? booking.mode === "retrait"
                      ? "Retrait — gratuit"
                      : "Incluse (zone Papenoo – Papeete)"
                    : formatXPF(booking.deliveryFee)}
                </span>
              </div>
              {item.deposit ? (
                <div className="flex justify-between text-navy-400">
                  <span>Caution (restituée)</span>
                  <span>{formatXPF(item.deposit)}</span>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex justify-between border-t border-mist-300 pt-3 font-semibold text-navy-900">
              <span>Total</span>
              <span>{formatXPF(booking.total)}</span>
            </div>
          </div>
        </Card>

        {/* Fiche client */}
        <Card className="h-fit p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-100 text-navy-700">
              <UserRound size={20} />
            </span>
            <div>
              <p className="font-semibold text-navy-900">
                {customer.firstName} {customer.lastName}
              </p>
              <p className="text-xs text-navy-400">
                Client depuis {formatDate(customer.createdAt, { month: "long", year: "numeric", day: undefined })}
              </p>
            </div>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-center gap-2.5 text-navy-600">
              <Phone size={15} className="text-lagoon-600" /> {customer.phone}
            </div>
            <div className="flex items-center gap-2.5 text-navy-600">
              <MapPin size={15} className="text-lagoon-600" /> {customer.commune}
            </div>
          </dl>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-mist-200 pt-5 text-center">
            <div>
              <p className="text-xl font-semibold text-navy-900">
                {customer.bookingsCount}
              </p>
              <p className="text-xs text-navy-400">réservations</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-navy-900">
                {formatXPF(customer.totalSpent)}
              </p>
              <p className="text-xs text-navy-400">dépensés</p>
            </div>
          </div>
          <Link
            href="/admin/clients"
            className="mt-5 block text-center text-sm font-medium text-lagoon-600 hover:underline"
          >
            Voir la fiche client complète
          </Link>
        </Card>
      </div>
    </>
  );
}
