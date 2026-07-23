// Passerelle brouillon d'agent → session d'import : l'écran de
// vérification existant (puis import-runner) reste l'unique voie vers les
// données réelles. Rien n'est perdu : ce que la fiche matériel ne porte
// pas (tarif horaire/hebdo, options) est reporté en description.

import type { OnboardingDraft, Confidence } from "@/lib/agent/draft";
import type {
  FieldConfidence,
  ImportSessionData,
  ParsedItem,
} from "@/lib/types/import";
import { localId } from "@/lib/import/normalize";

function toFieldConfidence(confidence: Confidence): FieldConfidence {
  switch (confidence) {
    case "confirmed":
      return "detected";
    case "probable":
    case "verify":
      return "probable";
    case "missing":
      return "missing";
  }
}

function formatXpf(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} XPF`;
}

/** Compose les notes de livraison à partir de la structure du brouillon. */
export function deliveryNotes(draft: OnboardingDraft): string | null {
  const { delivery } = draft;
  if (delivery.enabled === null) return null;
  if (delivery.enabled === false) return "Pas de livraison.";
  const parts: string[] = [];
  if (delivery.freeZones.length > 0) {
    parts.push(`Livraison gratuite : ${delivery.freeZones.join(", ")}`);
  }
  for (const zone of delivery.paidZones) {
    parts.push(
      zone.fee !== null
        ? `Livraison ${zone.zone} : ${formatXpf(zone.fee)}`
        : `Livraison ${zone.zone} : tarif à préciser`
    );
  }
  if (delivery.notes) parts.push(delivery.notes);
  return parts.join(" · ") || "Livraison proposée.";
}

/** Description d'entreprise composée (activité, règles, horaires, docs). */
export function businessDescription(draft: OnboardingDraft): string | null {
  const parts: string[] = [];
  if (draft.business.description) parts.push(draft.business.description);
  const rules = draft.bookingRules;
  if (rules.requestedDocuments && rules.requestedDocuments.length > 0) {
    parts.push(`Documents demandés : ${rules.requestedDocuments.join(", ")}.`);
  } else if (rules.requestedDocuments !== null) {
    parts.push("Aucun document demandé aux clients.");
  }
  if (rules.paymentMethods && rules.paymentMethods.length > 0) {
    parts.push(`Paiement : ${rules.paymentMethods.join(", ")}.`);
  }
  if (rules.advanceNoticeHours !== null) {
    parts.push(`Préavis de réservation : ${rules.advanceNoticeHours} h.`);
  }
  if (draft.business.openingHours) {
    parts.push(`Horaires : ${draft.business.openingHours}.`);
  }
  if (rules.terms) parts.push(rules.terms);
  return parts.join("\n") || null;
}

/** Fusionne le brouillon d'agent dans une session d'import existante. */
export function applyDraftToSession(
  draft: OnboardingDraft,
  base: ImportSessionData
): ImportSessionData {
  const categoryName = (categoryId: string | null): string =>
    draft.categories.find((c) => c.id === categoryId)?.name ?? "";

  const items: ParsedItem[] = draft.items.map((item) => {
    const descriptionParts: string[] = [];
    if (item.description) descriptionParts.push(item.description);
    if (item.options.length > 0) {
      descriptionParts.push(`Options : ${item.options.join(", ")}.`);
    }
    if (item.hourlyPrice !== null) {
      descriptionParts.push(`Tarif horaire : ${formatXpf(item.hourlyPrice)}.`);
    }
    if (item.weeklyPrice !== null) {
      descriptionParts.push(
        `Tarif hebdomadaire : ${formatXpf(item.weeklyPrice)}.`
      );
    }
    const displayName =
      item.brand && !item.name.toLowerCase().includes(item.brand.toLowerCase())
        ? `${item.brand} ${item.name}`
        : item.name;

    return {
      id: localId(),
      name: displayName,
      categoryName: categoryName(item.categoryId),
      tracking: item.tracking,
      quantity: item.quantity,
      dailyPrice: item.dailyPrice,
      pricingMode: item.pricingMode,
      depositAmount: item.deposit,
      minRentalDays: draft.bookingRules.minimumDurationDays ?? 1,
      internalRef: "",
      description: descriptionParts.join("\n"),
      internalNotes: "",
      priceConfidence: item.confirmed
        ? "detected"
        : toFieldConfidence(item.priceConfidence),
      depositConfidence: item.confirmed
        ? "detected"
        : toFieldConfidence(item.depositConfidence),
      duplicateOfId: null,
      duplicateOfName: null,
      duplicateResolution: "create",
      excluded: false,
    };
  });

  const referenced = new Set(
    draft.items.map((i) => i.categoryId).filter(Boolean)
  );
  const extraCategories = draft.categories
    .filter((c) => !referenced.has(c.id))
    .map((c) => c.name);

  return {
    ...base,
    business: {
      name: draft.business.name ?? base.business.name,
      description: businessDescription(draft) ?? base.business.description,
      phone: draft.business.phone ?? base.business.phone,
      email: draft.business.email ?? base.business.email,
      address: draft.business.address ?? base.business.address,
      deliveryNotes: deliveryNotes(draft) ?? base.business.deliveryNotes,
    },
    items: [...base.items, ...items],
    extraCategories: [
      ...new Set([...base.extraCategories, ...extraCategories]),
    ],
  };
}
