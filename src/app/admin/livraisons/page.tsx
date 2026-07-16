import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, PackageCheck, Truck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/shell";
import { Badge, Button, Card } from "@/components/ui";
import {
  BOOKINGS,
  DELIVERY_TOUR,
  getBooking,
  getCustomer,
  getItem,
} from "@/lib/data";
import { formatDateShort, formatXPF } from "@/lib/format";

export const metadata: Metadata = { title: "Livraisons" };

export default function DeliveriesPage() {
  const upcomingDeliveries = BOOKINGS.filter(
    (b) =>
      b.mode === "livraison" &&
      ["en_attente", "confirmee"].includes(b.status) &&
      b.date > "2026-07-16"
  ).sort((a, b) => (a.date > b.date ? 1 : -1));

  return (
    <>
      <AdminPageHeader
        title="Livraisons"
        description="Tournée du jour et livraisons à planifier. Zone incluse : Papenoo – Papeete."
        action={<Button variant="accent" size="sm">Optimiser la tournée</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tournée du jour */}
        <Card className="p-6">
          <h2 className="flex items-center gap-2 font-semibold text-navy-900">
            <Truck size={18} className="text-lagoon-600" />
            Tournée du mercredi 16 juillet
          </h2>
          <ol className="mt-5 space-y-0">
            {DELIVERY_TOUR.map((stop, i) => {
              const booking = getBooking(stop.bookingId)!;
              const customer = getCustomer(booking.customerId)!;
              const item = getItem(booking.itemSlug)!;
              return (
                <li key={stop.bookingId + stop.type} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">
                      {i + 1}
                    </span>
                    {i < DELIVERY_TOUR.length - 1 ? (
                      <span className="my-1 w-px flex-1 bg-mist-300" />
                    ) : null}
                  </div>
                  <div className="pb-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-navy-900">
                        {customer.firstName} {customer.lastName}
                      </p>
                      <Badge tone={stop.type === "livraison" ? "lagoon" : "navy"}>
                        {stop.type === "livraison" ? "Livraison" : "Récupération"}
                      </Badge>
                      <span className="text-xs font-medium text-lagoon-700">
                        {stop.window}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-navy-500">{item.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-navy-400">
                      <MapPin size={12} />
                      {booking.address} — {booking.commune}
                    </p>
                    <Link
                      href={`/admin/reservations/${booking.id}`}
                      className="mt-1.5 inline-block text-xs font-medium text-lagoon-600 hover:underline"
                    >
                      Voir la réservation {booking.reference}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        {/* À planifier */}
        <Card className="h-fit p-6">
          <h2 className="flex items-center gap-2 font-semibold text-navy-900">
            <PackageCheck size={18} className="text-lagoon-600" />
            À planifier
          </h2>
          <ul className="mt-5 space-y-3">
            {upcomingDeliveries.map((b) => {
              const customer = getCustomer(b.customerId)!;
              const item = getItem(b.itemSlug)!;
              return (
                <li key={b.id} className="rounded-xl border border-mist-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-navy-900">
                      {formatDateShort(b.date)} · {b.timeSlot}
                    </p>
                    <span className="text-xs text-navy-400">
                      {b.deliveryFee > 0
                        ? `Suppl. ${formatXPF(b.deliveryFee)}`
                        : "Zone incluse"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-navy-500">
                    {customer.firstName} {customer.lastName} · {item.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-navy-400">
                    <MapPin size={12} /> {b.commune}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
