"use client";

import { CheckCircle2, CalendarDays, MapPin, Phone } from "lucide-react";
import type { DemoBooking } from "../reservation/reservation-wizard";
import { formatDate, formatXPF } from "@/lib/format";
import { ButtonLink, Card } from "@/components/ui";
import { COMPANY } from "@/lib/data";
import { useLocalStorageJSON } from "@/lib/use-local-storage";

export function ConfirmationContent() {
  const { value: booking, loaded } = useLocalStorageJSON<DemoBooking>(
    "prc-demo-booking"
  );

  if (!loaded) return <div className="min-h-[50vh]" />;

  if (!booking) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-navy-900">
          Aucune réservation récente
        </h1>
        <p className="mt-3 text-navy-500">
          Simulez d&apos;abord une réservation pour voir cette page.
        </p>
        <ButtonLink href="/reservation" variant="accent" className="mt-6">
          Faire une réservation
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={34} />
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-navy-900">
          Réservation confirmée !
        </h1>
        <p className="mt-2 text-navy-500">
          Merci {booking.customer.firstName} — un e-mail de confirmation fictif
          a été « envoyé » à {booking.customer.email}.
        </p>
        <p className="mt-4 inline-block rounded-full bg-navy-950 px-5 py-2 text-sm font-medium text-white">
          Référence : <span className="text-lagoon-300">{booking.reference}</span>
        </p>
      </div>

      <Card className="mt-10 divide-y divide-mist-200">
        <div className="flex items-start gap-4 p-5">
          <CalendarDays size={20} className="mt-0.5 shrink-0 text-lagoon-600" />
          <div>
            <p className="font-medium text-navy-900">{booking.itemName}</p>
            <p className="mt-0.5 text-sm text-navy-500">
              {formatDate(booking.date)} · {booking.timeSlot}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 p-5">
          <MapPin size={20} className="mt-0.5 shrink-0 text-lagoon-600" />
          <div>
            <p className="font-medium text-navy-900">
              {booking.mode === "livraison"
                ? `Livraison — ${booking.commune}`
                : "Retrait au dépôt (Papeete)"}
            </p>
            {booking.address ? (
              <p className="mt-0.5 text-sm text-navy-500">{booking.address}</p>
            ) : null}
          </div>
        </div>
        <div className="p-5">
          <div className="flex justify-between text-sm text-navy-500">
            <span>{booking.itemName}</span>
            <span>{formatXPF(booking.itemPrice)}</span>
          </div>
          <div className="mt-1.5 flex justify-between text-sm text-navy-500">
            <span>Livraison</span>
            <span>
              {booking.deliveryFee === 0
                ? "Incluse"
                : formatXPF(booking.deliveryFee)}
            </span>
          </div>
          <div className="mt-3 flex justify-between border-t border-mist-200 pt-3 font-semibold text-navy-900">
            <span>Total</span>
            <span>{formatXPF(booking.total)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-mist-50 p-5 text-sm text-navy-600">
          <Phone size={17} className="shrink-0 text-lagoon-600" />
          Une question ? Appelez-nous au {COMPANY.phone}.
        </div>
      </Card>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <ButtonLink href="/compte" variant="primary">
          Voir mes réservations
        </ButtonLink>
        <ButtonLink href="/" variant="outline">
          Retour à l&apos;accueil
        </ButtonLink>
      </div>
    </div>
  );
}
