"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, CalendarPlus, Check, UserPlus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBooking } from "@/server/actions/bookings";
import { createCustomer } from "@/server/actions/customers";
import { setEquipmentStatus } from "@/server/actions/equipment";
import { formatMoney } from "@/lib/core/format";
import type { AssistantProposal } from "@/lib/ai/proposals";

// Carte de confirmation d'une action préparée par l'assistant.
// Rien n'est exécuté tant que l'utilisateur ne clique pas « Confirmer » ;
// la confirmation passe par les server actions habituelles (re-validation
// complète côté serveur, y compris la disponibilité).
export function ProposalCard({
  proposal,
  currency,
  stale = false,
  onDone,
}: {
  proposal: AssistantProposal;
  currency: string;
  stale?: boolean;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | { status: "confirmed"; link?: { href: string; label: string } }
    | { status: "dismissed" }
    | null
  >(null);

  const confirm = () => {
    startTransition(async () => {
      switch (proposal.kind) {
        case "booking_proposal": {
          const res = await createBooking(proposal.payload);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Réservation créée");
          setResult({
            status: "confirmed",
            link: {
              href: `/bookings/${res.data.bookingId}`,
              label: "Voir la réservation",
            },
          });
          break;
        }
        case "customer_proposal": {
          const res = await createCustomer(proposal.payload);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Client créé");
          setResult({
            status: "confirmed",
            link: {
              href: `/customers/${res.data.customerId}`,
              label: "Voir la fiche client",
            },
          });
          break;
        }
        case "equipment_status_proposal": {
          const res = await setEquipmentStatus(proposal.payload);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Statut du matériel mis à jour");
          setResult({ status: "confirmed" });
          break;
        }
      }
      onDone?.();
    });
  };

  const header =
    proposal.kind === "booking_proposal" ? (
      <>
        <CalendarPlus className="size-4 text-sky-700" aria-hidden />
        Nouvelle réservation
      </>
    ) : proposal.kind === "customer_proposal" ? (
      <>
        <UserPlus className="size-4 text-sky-700" aria-hidden />
        Nouveau client
      </>
    ) : (
      <>
        <Wrench className="size-4 text-sky-700" aria-hidden />
        Changement de statut
      </>
    );

  return (
    <div className="max-w-[85%] rounded-lg border border-sky-200 bg-sky-50/60 p-3.5 text-sm">
      <p className="flex items-center gap-2 font-medium text-neutral-900">
        {header}
      </p>

      <div className="mt-2 space-y-1 text-neutral-700">
        {proposal.kind === "booking_proposal" && (
          <>
            <p>
              <span className="text-neutral-500">Client :</span>{" "}
              {proposal.summary.customerName}
            </p>
            <p>
              <span className="text-neutral-500">Matériel :</span>{" "}
              {proposal.summary.items
                .map(
                  (i) =>
                    `${i.equipmentName}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`
                )
                .join(", ")}
            </p>
            <p>
              <span className="text-neutral-500">Période :</span>{" "}
              {proposal.summary.startAt.replace("T", " à ")} →{" "}
              {proposal.summary.endAt.replace("T", " à ")} (
              {proposal.summary.durationDays} jour
              {proposal.summary.durationDays > 1 ? "s" : ""})
            </p>
            <p>
              <span className="text-neutral-500">Prix estimé :</span>{" "}
              <strong>{formatMoney(proposal.summary.total, currency)}</strong>
              {" — "}
              <span className="text-neutral-500">Caution :</span>{" "}
              {formatMoney(proposal.summary.deposit, currency)}
            </p>
            {proposal.summary.warnings.map((warning, i) => (
              <p key={i} className="flex items-start gap-1.5 text-amber-800">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {warning}
              </p>
            ))}
          </>
        )}

        {proposal.kind === "customer_proposal" && (
          <>
            <p>
              <span className="text-neutral-500">Nom :</span>{" "}
              {proposal.summary.displayName}
            </p>
            {proposal.payload.email && (
              <p>
                <span className="text-neutral-500">Email :</span>{" "}
                {proposal.payload.email}
              </p>
            )}
            {proposal.payload.phone && (
              <p>
                <span className="text-neutral-500">Téléphone :</span>{" "}
                {proposal.payload.phone}
              </p>
            )}
          </>
        )}

        {proposal.kind === "equipment_status_proposal" && (
          <p>
            <span className="text-neutral-500">Matériel :</span>{" "}
            {proposal.summary.equipmentName} →{" "}
            <strong>{proposal.summary.statusLabel}</strong>
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {result?.status === "confirmed" ? (
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <Check className="size-4" aria-hidden /> Confirmé
            {result.link && (
              <Link
                href={result.link.href}
                className="ml-2 text-sky-700 underline underline-offset-2"
              >
                {result.link.label}
              </Link>
            )}
          </span>
        ) : result?.status === "dismissed" ? (
          <span className="text-neutral-500">Ignoré</span>
        ) : stale ? (
          <span className="text-xs text-neutral-500">
            Proposition issue d&apos;une conversation précédente — redemandez à
            l&apos;assistant pour la régénérer.
          </span>
        ) : (
          <>
            <Button size="sm" onClick={confirm} disabled={pending}>
              {pending ? "Création…" : "Confirmer"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setResult({ status: "dismissed" })}
            >
              Ignorer
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
