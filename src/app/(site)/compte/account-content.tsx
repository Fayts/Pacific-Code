"use client";

import Link from "next/link";
import { CalendarDays, MapPin, Sparkles, UserRound } from "lucide-react";
import type { DemoBooking } from "../reservation/reservation-wizard";
import {
  BOOKINGS,
  BOOKING_STATUS_LABELS,
  CURRENT_CLIENT_ID,
  getCustomer,
  getItem,
} from "@/lib/data";
import { formatDate, formatXPF } from "@/lib/format";
import { useLocalStorageJSON } from "@/lib/use-local-storage";
import { Badge, ButtonLink, Card } from "@/components/ui";

const STATUS_TONES = {
  en_attente: "amber",
  confirmee: "lagoon",
  en_cours: "navy",
  terminee: "green",
  annulee: "red",
} as const;

export function AccountContent() {
  const customer = getCustomer(CURRENT_CLIENT_ID)!;
  const demoHistory = BOOKINGS.filter((b) => b.customerId === CURRENT_CLIENT_ID);
  const { value } = useLocalStorageJSON<DemoBooking[]>("prc-demo-bookings");
  const localBookings = value ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {/* En-tête du compte */}
      <Card className="flex flex-col gap-5 bg-navy-950 p-7 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lagoon-500/20 text-lagoon-300">
            <UserRound size={26} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Ia ora na, {customer.firstName} !
            </h1>
            <p className="mt-0.5 text-sm text-navy-300">
              {customer.email} · {customer.commune}
            </p>
          </div>
        </div>
        <ButtonLink href="/reservation" variant="accent">
          Nouvelle réservation
        </ButtonLink>
      </Card>

      {/* Réservations simulées dans cette session */}
      {localBookings.length > 0 ? (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-navy-900">
            <Sparkles size={18} className="text-lagoon-600" />
            Vos réservations simulées
          </h2>
          <div className="mt-4 space-y-3">
            {localBookings.map((b) => (
              <Card
                key={b.reference + b.createdAt}
                className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <p className="font-semibold text-navy-900">{b.itemName}</p>
                    <Badge tone="lagoon">Confirmée</Badge>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={14} /> {formatDate(b.date)} · {b.timeSlot}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} />
                      {b.mode === "livraison" ? b.commune : "Retrait au dépôt"}
                    </span>
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold text-navy-900">{formatXPF(b.total)}</p>
                  <p className="text-xs text-navy-400">Réf. {b.reference}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* Historique fictif */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-navy-900">
          Historique de réservations
        </h2>
        <div className="mt-4 space-y-3">
          {demoHistory.map((b) => {
            const item = getItem(b.itemSlug)!;
            return (
              <Card
                key={b.id}
                className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <p className="font-semibold text-navy-900">{item.name}</p>
                    <Badge tone={STATUS_TONES[b.status]}>
                      {BOOKING_STATUS_LABELS[b.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={14} /> {formatDate(b.date)} · {b.timeSlot}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} />
                      {b.mode === "livraison" ? b.commune : "Retrait au dépôt"}
                    </span>
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold text-navy-900">{formatXPF(b.total)}</p>
                  <p className="text-xs text-navy-400">Réf. {b.reference}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <p className="mt-10 text-center text-sm text-navy-400">
        Espace client fictif — l&apos;authentification réelle sera ajoutée plus
        tard avec Supabase.{" "}
        <Link href="/admin" className="text-lagoon-600 underline">
          Voir l&apos;espace administrateur
        </Link>
      </p>
    </div>
  );
}
