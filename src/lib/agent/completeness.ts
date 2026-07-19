// Progression réelle du brouillon : calculée sur la complétude des
// données, pas sur un nombre de questions. Une section répondue par la
// négative (« pas de livraison ») compte comme complète — les sujets non
// pertinents ne bloquent jamais la progression.

import type { OnboardingDraft } from "@/lib/agent/draft";

export type ChecklistEntry = {
  id: string;
  label: string;
  done: boolean;
  /** Fraction accomplie (0..1) pour les sections proportionnelles. */
  ratio: number;
};

export type Completeness = {
  /** 0..100, arrondi. */
  percent: number;
  checklist: ChecklistEntry[];
  readyForReview: boolean;
};

const WEIGHTS = {
  business: 20,
  catalog: 25,
  pricing: 25,
  deposits: 10,
  delivery: 10,
  documents: 10,
} as const;

export function computeCompleteness(draft: OnboardingDraft): Completeness {
  const items = draft.items;
  const priced = items.filter(
    (i) =>
      i.dailyPrice !== null || i.hourlyPrice !== null || i.weeklyPrice !== null
  );
  const withDeposit = items.filter((i) => i.deposit !== null);

  const business = draft.business.name ? 1 : 0;
  const catalog = items.length > 0 ? 1 : 0;
  const pricing = items.length > 0 ? priced.length / items.length : 0;
  const deposits = items.length > 0 ? withDeposit.length / items.length : 0;
  const delivery = draft.delivery.enabled !== null ? 1 : 0;
  const documents = draft.bookingRules.requestedDocuments !== null ? 1 : 0;

  const percent = Math.round(
    business * WEIGHTS.business +
      catalog * WEIGHTS.catalog +
      pricing * WEIGHTS.pricing +
      deposits * WEIGHTS.deposits +
      delivery * WEIGHTS.delivery +
      documents * WEIGHTS.documents
  );

  const checklist: ChecklistEntry[] = [
    {
      id: "business",
      label: "Entreprise identifiée",
      done: business === 1,
      ratio: business,
    },
    {
      id: "catalog",
      label: "Catalogue détecté",
      done: catalog === 1,
      ratio: catalog,
    },
    {
      id: "pricing",
      label:
        items.length > 0
          ? `Tarifs renseignés (${priced.length}/${items.length})`
          : "Tarifs renseignés",
      done: items.length > 0 && pricing === 1,
      ratio: pricing,
    },
    {
      id: "deposits",
      label:
        items.length > 0
          ? `Cautions renseignées (${withDeposit.length}/${items.length})`
          : "Cautions renseignées",
      done: items.length > 0 && deposits === 1,
      ratio: deposits,
    },
    {
      id: "delivery",
      label: "Livraison configurée",
      done: delivery === 1,
      ratio: delivery,
    },
    {
      id: "documents",
      label: "Documents client configurés",
      done: documents === 1,
      ratio: documents,
    },
  ];

  return {
    percent,
    checklist,
    // Vérifiable dès qu'il y a un catalogue tarifé pour l'essentiel.
    readyForReview: items.length > 0 && pricing >= 0.5,
  };
}
