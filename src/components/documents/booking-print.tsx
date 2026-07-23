"use client";

// Documents imprimables d'une réservation : contrat de location et facture.
// Pages A4 épurées, hors du chrome de l'application — le bouton lance
// l'impression du navigateur (ou « Enregistrer en PDF »). Aucune dépendance
// de génération PDF : le rendu imprimé EST le document.

import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import type { BookingWithRelations } from "@/lib/data/repositories";
import { DEPOSIT_STATUS, PAYMENT_STATUS } from "@/lib/core/labels";
import {
  formatCustomerName,
  formatDate,
  formatDateTime,
  formatMoney,
} from "@/lib/core/format";
import { Button } from "@/components/ui/button";

export type BookingDocumentKind = "contract" | "invoice";

const CONTRACT_TERMS = [
  "Le matériel est remis en bon état de fonctionnement. Le client s'engage à le restituer dans le même état, à la date et à l'heure convenues.",
  "Le client est responsable du matériel loué pendant toute la durée de la location, y compris en cas de perte, de vol ou de dégradation.",
  "La caution éventuelle est restituée à la fin de la location, après vérification de l'état du matériel. Les frais de remise en état ou de remplacement peuvent y être imputés.",
  "Tout retard de restitution non convenu peut être facturé au tarif journalier en vigueur.",
  "Toute annulation doit être signalée au loueur dans les meilleurs délais.",
];

export function BookingPrint({
  id,
  kind,
}: {
  id: string;
  kind: BookingDocumentKind;
}) {
  const { provider, organization, loading } = useAppData();
  const [booking, setBooking] = useState<BookingWithRelations | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    provider.bookings.get(id).then((result) => {
      if (cancelled) return;
      setBooking(result);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, id, loading]);

  if (loading || !ready) {
    return (
      <p className="p-10 text-center text-sm text-muted-foreground">
        Préparation du document…
      </p>
    );
  }
  if (!organization || !booking) {
    return (
      <p className="p-10 text-center text-sm text-muted-foreground">
        Document introuvable — ouvrez-le depuis la fiche de la réservation.
      </p>
    );
  }

  const tz = organization.timezone;
  const currency = organization.currency;
  const customer = booking.customer;
  const title = kind === "contract" ? "Contrat de location" : "Facture";
  const documentNumber =
    kind === "contract"
      ? booking.booking_number
      : `FAC-${booking.booking_number}`;
  const issuedAt =
    kind === "invoice"
      ? (booking.completed_at ?? booking.created_at)
      : booking.created_at;

  return (
    <div className="min-h-svh bg-muted/40 print:bg-white">
      {/* Barre d'actions — jamais imprimée */}
      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-2 px-4 py-3 print:hidden">
        <button
          type="button"
          onClick={() => window.close()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Fermer
        </button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Imprimer / Enregistrer en PDF
        </Button>
      </div>

      {/* Feuille A4 */}
      <div className="mx-auto max-w-[210mm] bg-white px-[14mm] py-[12mm] text-[13px] leading-relaxed text-neutral-900 shadow-lg print:max-w-none print:shadow-none">
        {/* En-tête */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-800 pb-4">
          <div>
            <p className="text-xl font-bold tracking-tight">
              {organization.name}
            </p>
            {organization.address && <p>{organization.address}</p>}
            <p>
              {[organization.phone, organization.email]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-wide">{title}</p>
            <p className="font-mono">{documentNumber}</p>
            <p>Le {formatDate(issuedAt, tz)}</p>
          </div>
        </header>

        {/* Parties */}
        <section className="mt-5 grid grid-cols-2 gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {kind === "contract" ? "Le loueur" : "Émetteur"}
            </p>
            <p className="font-semibold">{organization.name}</p>
            {organization.address && <p>{organization.address}</p>}
            {organization.phone && <p>{organization.phone}</p>}
            {organization.email && <p>{organization.email}</p>}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {kind === "contract" ? "Le client" : "Adressée à"}
            </p>
            <p className="font-semibold">
              {customer ? formatCustomerName(customer) : "—"}
            </p>
            {customer?.address && <p>{customer.address}</p>}
            {customer?.phone && <p>{customer.phone}</p>}
            {customer?.email && <p>{customer.email}</p>}
          </div>
        </section>

        {/* Période */}
        <section className="mt-5 rounded border border-neutral-300 px-4 py-3">
          <p>
            <span className="font-semibold">Période de location :</span> du{" "}
            {formatDateTime(booking.start_at, tz)} au{" "}
            {formatDateTime(booking.end_at, tz)} ({booking.duration_days}{" "}
            jour{booking.duration_days > 1 ? "s" : ""})
          </p>
          {booking.notes && (
            <p className="mt-1">
              <span className="font-semibold">Notes :</span> {booking.notes}
            </p>
          )}
        </section>

        {/* Matériels */}
        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-800 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <th className="py-1.5 pr-2">Désignation</th>
              <th className="py-1.5 pr-2 text-center">Qté</th>
              <th className="py-1.5 pr-2 text-right">Prix unitaire</th>
              <th className="py-1.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {booking.items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-200">
                <td className="py-2 pr-2">
                  {item.equipment?.name ?? "Matériel"}
                </td>
                <td className="py-2 pr-2 text-center">{item.quantity}</td>
                <td className="py-2 pr-2 text-right">
                  {formatMoney(item.daily_price, currency)}
                </td>
                <td className="py-2 text-right">
                  {formatMoney(item.line_total, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totaux */}
        <section className="mt-4 ml-auto w-64 space-y-1">
          <div className="flex justify-between">
            <span>Sous-total</span>
            <span>{formatMoney(booking.subtotal, currency)}</span>
          </div>
          {booking.discount_amount > 0 && (
            <div className="flex justify-between">
              <span>Remise</span>
              <span>−{formatMoney(booking.discount_amount, currency)}</span>
            </div>
          )}
          {booking.extra_fees_amount > 0 && (
            <div className="flex justify-between">
              <span>Frais supplémentaires</span>
              <span>{formatMoney(booking.extra_fees_amount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between border-t-2 border-neutral-800 pt-1 text-base font-bold">
            <span>Total</span>
            <span>{formatMoney(booking.total_amount, currency)}</span>
          </div>
          {booking.deposit_amount > 0 && (
            <div className="flex justify-between text-neutral-600">
              <span>Caution ({DEPOSIT_STATUS[booking.deposit_status].label.toLowerCase()})</span>
              <span>{formatMoney(booking.deposit_amount, currency)}</span>
            </div>
          )}
        </section>

        {kind === "invoice" ? (
          <section className="mt-6 space-y-1">
            <p>
              <span className="font-semibold">Règlement :</span>{" "}
              {PAYMENT_STATUS[booking.payment_status].label}
            </p>
            <p className="text-neutral-600">
              Montants exprimés en {currency}.
            </p>
          </section>
        ) : (
          <>
            {/* Conditions */}
            <section className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Conditions de location
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                {CONTRACT_TERMS.map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ol>
            </section>

            {/* Signatures */}
            <section className="mt-8 grid grid-cols-2 gap-8">
              {["Le loueur", "Le client (lu et approuvé)"].map((party) => (
                <div key={party}>
                  <p className="font-semibold">{party}</p>
                  <p className="mt-1 text-neutral-500">
                    Fait à ________________ , le ____ / ____ / ________
                  </p>
                  <div className="mt-3 h-20 rounded border border-dashed border-neutral-400" />
                </div>
              ))}
            </section>
          </>
        )}

        <footer className="mt-8 border-t border-neutral-200 pt-2 text-center text-[11px] text-neutral-400">
          Document généré par Pacific Code — {organization.name}
        </footer>
      </div>

      <div className="h-8 print:hidden" />
    </div>
  );
}
