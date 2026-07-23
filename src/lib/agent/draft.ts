// Brouillon structuré de l'agent d'onboarding.
// C'est la SEULE structure que l'IA peut modifier (via les outils de
// tools.ts) : elle vit côté client + requêtes, jamais dans les tables
// réelles. L'import définitif passe par l'écran de vérification puis
// import-runner, comme tous les autres parcours.

import { z } from "zod";

/** Fiabilité d'une valeur : l'IA n'invente jamais une donnée importante. */
export const CONFIDENCES = [
  "confirmed",
  "probable",
  "verify",
  "missing",
] as const;
export type Confidence = (typeof CONFIDENCES)[number];

const confidenceSchema = z.enum(CONFIDENCES);

const money = z.number().int().min(0).max(99_999_999);
const shortText = z.string().trim().max(200);
const longText = z.string().trim().max(2000);

export const ACTIVITY_TYPES = [
  "materiel",
  "vehicules",
  "logements",
  "mixte",
  "autre",
] as const;

export const draftBusinessSchema = z.object({
  name: shortText.nullable(),
  activityType: z.enum(ACTIVITY_TYPES).nullable(),
  description: longText.nullable(),
  phone: z.string().trim().max(50).nullable(),
  email: z.string().trim().max(200).nullable(),
  address: z.string().trim().max(500).nullable(),
  /** Horaires d'ouverture / de retrait, en texte libre. */
  openingHours: z.string().trim().max(500).nullable(),
  currency: z.string().trim().max(10),
  timezone: z.string().trim().max(60),
});

export const draftCategorySchema = z.object({
  /** Identifiant temporaire (c1, c2…) — jamais un id de base. */
  id: z.string().trim().min(1).max(20),
  name: shortText.min(1),
  type: z.enum(["materiel", "vehicule", "logement", "autre"]),
});

export const draftItemSchema = z.object({
  /** Identifiant temporaire (i1, i2…) — jamais un id de base. */
  id: z.string().trim().min(1).max(20),
  name: shortText.min(1),
  brand: shortText.nullable(),
  model: shortText.nullable(),
  /** Référence draft.categories[].id. */
  categoryId: z.string().trim().max(20).nullable(),
  /** stock = une fiche avec quantité ; individual = N fiches numérotées. */
  tracking: z.enum(["stock", "individual"]),
  quantity: z.number().int().min(1).max(10_000),
  dailyPrice: money.nullable(),
  /** "daily" : prix × durée ; "flat" : forfait / prestation à prix fixe. */
  pricingMode: z.enum(["daily", "flat"]).default("daily"),
  hourlyPrice: money.nullable(),
  weeklyPrice: money.nullable(),
  deposit: money.nullable(),
  description: longText,
  /** Options et accessoires inclus ou proposés (casque, GPS, draps…). */
  options: z.array(shortText).max(30),
  priceConfidence: confidenceSchema,
  depositConfidence: confidenceSchema,
  quantityConfidence: confidenceSchema,
  /** Vérifié par le loueur depuis la prévisualisation. */
  confirmed: z.boolean(),
});

export const draftDeliverySchema = z.object({
  /** null = pas encore abordé ; false = pas de livraison (répondu). */
  enabled: z.boolean().nullable(),
  freeZones: z.array(shortText).max(50),
  paidZones: z
    .array(z.object({ zone: shortText.min(1), fee: money.nullable() }))
    .max(50),
  notes: z.string().trim().max(1000).nullable(),
});

export const draftBookingRulesSchema = z.object({
  /** null = pas encore abordé ; [] = aucun document demandé (répondu). */
  requestedDocuments: z.array(shortText).max(20).nullable(),
  minimumDurationDays: z.number().int().min(1).max(365).nullable(),
  advanceNoticeHours: z.number().int().min(0).max(8760).nullable(),
  /** null = pas encore abordé. */
  paymentMethods: z.array(shortText).max(20).nullable(),
  terms: z.string().trim().max(2000).nullable(),
});

export const draftMissingSchema = z.object({
  id: z.string().trim().min(1).max(20),
  /** Sujet court (« tarif du Puzzi 8/1 », « zones de livraison »…). */
  topic: shortText.min(1),
  note: z.string().trim().max(500),
});

export const onboardingDraftSchema = z.object({
  v: z.literal(1),
  business: draftBusinessSchema,
  categories: z.array(draftCategorySchema).max(50),
  items: z.array(draftItemSchema).max(100),
  delivery: draftDeliverySchema,
  bookingRules: draftBookingRulesSchema,
  /** Agenda des informations manquantes, entretenu par l'agent. */
  missing: z.array(draftMissingSchema).max(50),
});

export type DraftBusiness = z.infer<typeof draftBusinessSchema>;
export type DraftCategory = z.infer<typeof draftCategorySchema>;
export type DraftItem = z.infer<typeof draftItemSchema>;
export type DraftDelivery = z.infer<typeof draftDeliverySchema>;
export type DraftBookingRules = z.infer<typeof draftBookingRulesSchema>;
export type DraftMissing = z.infer<typeof draftMissingSchema>;
export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;

export function emptyDraft(): OnboardingDraft {
  return {
    v: 1,
    business: {
      name: null,
      activityType: null,
      description: null,
      phone: null,
      email: null,
      address: null,
      openingHours: null,
      currency: "XPF",
      timezone: "Pacific/Tahiti",
    },
    categories: [],
    items: [],
    delivery: { enabled: null, freeZones: [], paidZones: [], notes: null },
    bookingRules: {
      requestedDocuments: null,
      minimumDurationDays: null,
      advanceNoticeHours: null,
      paymentMethods: null,
      terms: null,
    },
    missing: [],
  };
}

/** Prochain identifiant temporaire libre pour un préfixe (i, c, m). */
export function nextTempId(prefix: string, existing: Array<{ id: string }>) {
  let max = 0;
  for (const entry of existing) {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(entry.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${max + 1}`;
}
