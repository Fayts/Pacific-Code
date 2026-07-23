// Outils de l'agent d'onboarding : des RÉDUCTEURS PURS sur le brouillon.
// Chaque outil valide son entrée (Zod), retourne un nouveau brouillon et
// la liste des changements (pour les micro-animations de l'aperçu).
// Aucun outil ne touche la base : l'import réel passe par l'écran de
// vérification puis import-runner, après validation humaine.

import { z } from "zod";
import {
  ACTIVITY_TYPES,
  CONFIDENCES,
  nextTempId,
  type Confidence,
  type DraftItem,
  type OnboardingDraft,
} from "@/lib/agent/draft";

export type DraftChange = {
  kind:
    | "business"
    | "category"
    | "item_added"
    | "item_updated"
    | "item_removed"
    | "delivery"
    | "rules"
    | "missing"
    | "review";
  /** Libellé court affiché dans l'aperçu (« Bien ajouté »…). */
  label: string;
  /** Carte à mettre en évidence, le cas échéant. */
  itemId?: string;
};

export type ToolApplication = {
  draft: OnboardingDraft;
  changes: DraftChange[];
  /** Retour transmis au modèle (jamais affiché à l'utilisateur). */
  result: string;
};

type ToolDefinition = {
  description: string;
  schema: z.ZodType;
  apply: (draft: OnboardingDraft, input: unknown) => ToolApplication;
};

const money = z.number().int().min(0).max(99_999_999);
const shortText = z.string().trim().min(1).max(200);
const confidence = z.enum(CONFIDENCES);

function findItem(draft: OnboardingDraft, itemId: string): DraftItem {
  const item = draft.items.find((i) => i.id === itemId);
  if (!item) {
    throw new Error(
      `Bien introuvable : "${itemId}". Ids connus : ${
        draft.items.map((i) => i.id).join(", ") || "(aucun)"
      }.`
    );
  }
  return item;
}

function patchItem(
  draft: OnboardingDraft,
  itemId: string,
  patch: Partial<DraftItem>
): OnboardingDraft {
  return {
    ...draft,
    items: draft.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
  };
}

/** Trouve ou crée une catégorie par nom (insensible à la casse). */
function ensureCategory(
  draft: OnboardingDraft,
  name: string,
  type: "materiel" | "vehicule" | "logement" | "autre"
): { draft: OnboardingDraft; id: string; created: boolean } {
  const existing = draft.categories.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) return { draft, id: existing.id, created: false };
  const id = nextTempId("c", draft.categories);
  return {
    draft: { ...draft, categories: [...draft.categories, { id, name, type }] },
    id,
    created: true,
  };
}

// ------------------------------------------------------------------
// Registre des outils
// ------------------------------------------------------------------

const updateBusinessInformation: ToolDefinition = {
  description:
    "Met à jour les informations de l'entreprise (nom, type d'activité, description, téléphone, email, adresse, horaires). Ne renseigner que les champs réellement fournis par l'utilisateur.",
  schema: z.object({
    name: shortText.optional(),
    activityType: z.enum(ACTIVITY_TYPES).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
    phone: z.string().trim().min(1).max(50).optional(),
    email: z.string().trim().min(1).max(200).optional(),
    address: z.string().trim().min(1).max(500).optional(),
    openingHours: z.string().trim().min(1).max(500).optional(),
  }),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as Partial<
      OnboardingDraft["business"]
    >;
    if (Object.keys(input).length === 0) {
      throw new Error("Aucun champ fourni.");
    }
    return {
      draft: { ...draft, business: { ...draft.business, ...input } },
      changes: [{ kind: "business", label: "Entreprise mise à jour" }],
      result: `Entreprise mise à jour (${Object.keys(input).join(", ")}).`,
    };
  },
};

const addCategory: ToolDefinition = {
  description:
    "Ajoute une catégorie de biens (ex. « Matériel de nettoyage »). Réutilise automatiquement une catégorie existante du même nom.",
  schema: z.object({
    name: shortText,
    type: z.enum(["materiel", "vehicule", "logement", "autre"]),
  }),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as {
      name: string;
      type: "materiel" | "vehicule" | "logement" | "autre";
    };
    const ensured = ensureCategory(draft, input.name, input.type);
    return {
      draft: ensured.draft,
      changes: ensured.created
        ? [{ kind: "category", label: "Catégorie détectée" }]
        : [],
      result: ensured.created
        ? `Catégorie ${ensured.id} (« ${input.name} ») créée.`
        : `Catégorie existante réutilisée : ${ensured.id}.`,
    };
  },
};

const updateCategory: ToolDefinition = {
  description: "Renomme ou retype une catégorie existante du brouillon.",
  schema: z.object({
    categoryId: shortText,
    name: shortText.optional(),
    type: z.enum(["materiel", "vehicule", "logement", "autre"]).optional(),
  }),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as {
      categoryId: string;
      name?: string;
      type?: "materiel" | "vehicule" | "logement" | "autre";
    };
    const category = draft.categories.find((c) => c.id === input.categoryId);
    if (!category) {
      throw new Error(
        `Catégorie introuvable : "${input.categoryId}". Ids connus : ${
          draft.categories.map((c) => c.id).join(", ") || "(aucune)"
        }.`
      );
    }
    return {
      draft: {
        ...draft,
        categories: draft.categories.map((c) =>
          c.id === input.categoryId
            ? { ...c, name: input.name ?? c.name, type: input.type ?? c.type }
            : c
        ),
      },
      changes: [{ kind: "category", label: "Catégorie mise à jour" }],
      result: `Catégorie ${input.categoryId} mise à jour.`,
    };
  },
};

const addRentalItem: ToolDefinition = {
  description:
    "Ajoute un bien à louer au brouillon. Renseigner uniquement ce que l'utilisateur a dit — JAMAIS de prix, caution ou quantité inventés. categoryName crée ou réutilise la catégorie automatiquement.",
  schema: z.object({
    name: shortText,
    brand: shortText.optional(),
    model: shortText.optional(),
    categoryName: shortText.optional(),
    categoryType: z
      .enum(["materiel", "vehicule", "logement", "autre"])
      .optional(),
    tracking: z.enum(["stock", "individual"]).optional(),
    quantity: z.number().int().min(1).max(10_000).optional(),
    dailyPrice: money.optional(),
    pricingMode: z.enum(["daily", "flat"]).optional(),
    hourlyPrice: money.optional(),
    weeklyPrice: money.optional(),
    deposit: money.optional(),
    description: z.string().trim().max(2000).optional(),
    options: z.array(shortText).max(30).optional(),
    priceConfidence: confidence.optional(),
    depositConfidence: confidence.optional(),
    quantityConfidence: confidence.optional(),
  }),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as Record<string, unknown> & {
      name: string;
      categoryName?: string;
      categoryType?: "materiel" | "vehicule" | "logement" | "autre";
    };

    let working = draft;
    let categoryId: string | null = null;
    const changes: DraftChange[] = [];
    if (input.categoryName) {
      const ensured = ensureCategory(
        working,
        input.categoryName,
        input.categoryType ?? "materiel"
      );
      working = ensured.draft;
      categoryId = ensured.id;
      if (ensured.created) {
        changes.push({ kind: "category", label: "Catégorie détectée" });
      }
    }

    const id = nextTempId("i", working.items);
    const dailyPrice = (input.dailyPrice as number | undefined) ?? null;
    const hourlyPrice = (input.hourlyPrice as number | undefined) ?? null;
    const weeklyPrice = (input.weeklyPrice as number | undefined) ?? null;
    const deposit = (input.deposit as number | undefined) ?? null;
    const hasPrice =
      dailyPrice !== null || hourlyPrice !== null || weeklyPrice !== null;

    const item: DraftItem = {
      id,
      name: input.name,
      brand: (input.brand as string | undefined) ?? null,
      model: (input.model as string | undefined) ?? null,
      categoryId,
      tracking:
        (input.tracking as "stock" | "individual" | undefined) ?? "stock",
      quantity: (input.quantity as number | undefined) ?? 1,
      dailyPrice,
      pricingMode:
        (input.pricingMode as "daily" | "flat" | undefined) ?? "daily",
      hourlyPrice,
      weeklyPrice,
      deposit,
      description: (input.description as string | undefined) ?? "",
      options: (input.options as string[] | undefined) ?? [],
      priceConfidence:
        (input.priceConfidence as Confidence | undefined) ??
        (hasPrice ? "probable" : "missing"),
      depositConfidence:
        (input.depositConfidence as Confidence | undefined) ??
        (deposit !== null ? "probable" : "missing"),
      quantityConfidence:
        (input.quantityConfidence as Confidence | undefined) ??
        (input.quantity !== undefined ? "confirmed" : "probable"),
      confirmed: false,
    };

    changes.push({ kind: "item_added", label: "Bien ajouté", itemId: id });
    return {
      draft: { ...working, items: [...working.items, item] },
      changes,
      result: `Bien ${id} (« ${item.name} », x${item.quantity}) ajouté.`,
    };
  },
};

const updateRentalItem: ToolDefinition = {
  description:
    "Met à jour les champs d'un bien existant (nom, marque, modèle, catégorie, description, options).",
  schema: z.object({
    itemId: shortText,
    name: shortText.optional(),
    brand: shortText.nullable().optional(),
    model: shortText.nullable().optional(),
    categoryName: shortText.optional(),
    categoryType: z
      .enum(["materiel", "vehicule", "logement", "autre"])
      .optional(),
    description: z.string().trim().max(2000).optional(),
    options: z.array(shortText).max(30).optional(),
  }),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as {
      itemId: string;
      name?: string;
      brand?: string | null;
      model?: string | null;
      categoryName?: string;
      categoryType?: "materiel" | "vehicule" | "logement" | "autre";
      description?: string;
      options?: string[];
    };
    findItem(draft, input.itemId);

    let working = draft;
    const patch: Partial<DraftItem> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.brand !== undefined) patch.brand = input.brand;
    if (input.model !== undefined) patch.model = input.model;
    if (input.description !== undefined) patch.description = input.description;
    if (input.options !== undefined) patch.options = input.options;
    if (input.categoryName) {
      const ensured = ensureCategory(
        working,
        input.categoryName,
        input.categoryType ?? "materiel"
      );
      working = ensured.draft;
      patch.categoryId = ensured.id;
    }

    return {
      draft: patchItem(working, input.itemId, patch),
      changes: [
        {
          kind: "item_updated",
          label: "Bien mis à jour",
          itemId: input.itemId,
        },
      ],
      result: `Bien ${input.itemId} mis à jour.`,
    };
  },
};

const removeRentalItem: ToolDefinition = {
  description:
    "Retire un bien du brouillon (uniquement à la demande de l'utilisateur ou en cas de doublon manifeste).",
  schema: z.object({ itemId: shortText }),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as { itemId: string };
    const item = findItem(draft, input.itemId);
    return {
      draft: {
        ...draft,
        items: draft.items.filter((i) => i.id !== input.itemId),
      },
      changes: [{ kind: "item_removed", label: "Bien retiré" }],
      result: `Bien ${input.itemId} (« ${item.name} ») retiré.`,
    };
  },
};

const setItemQuantity: ToolDefinition = {
  description:
    "Fixe la quantité d'un bien, et son mode d'inventaire si pertinent (individual = fiches numérotées pour véhicules/logements).",
  schema: z.object({
    itemId: shortText,
    quantity: z.number().int().min(1).max(10_000),
    tracking: z.enum(["stock", "individual"]).optional(),
    confidence: confidence.optional(),
  }),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as {
      itemId: string;
      quantity: number;
      tracking?: "stock" | "individual";
      confidence?: Confidence;
    };
    const item = findItem(draft, input.itemId);
    return {
      draft: patchItem(draft, input.itemId, {
        quantity: input.quantity,
        tracking: input.tracking ?? item.tracking,
        quantityConfidence: input.confidence ?? "confirmed",
      }),
      changes: [
        {
          kind: "item_updated",
          label: "Quantité mise à jour",
          itemId: input.itemId,
        },
      ],
      result: `Quantité du bien ${input.itemId} : ${input.quantity}.`,
    };
  },
};

const setItemPricing: ToolDefinition = {
  description:
    "Fixe les tarifs d'un bien (jour, heure et/ou semaine, en XPF entiers). pricingMode \"flat\" si le prix est un forfait fixe (prestation, prix à l'unité), \"daily\" s'il dépend de la durée. Utiliser confidence \"verify\" tant que l'utilisateur n'a pas confirmé la période (ex. montant donné sans préciser « par jour » ni « forfait »).",
  schema: z
    .object({
      itemId: shortText,
      dailyPrice: money.nullable().optional(),
      pricingMode: z.enum(["daily", "flat"]).optional(),
      hourlyPrice: money.nullable().optional(),
      weeklyPrice: money.nullable().optional(),
      confidence: confidence,
    })
    .refine(
      (v) =>
        v.dailyPrice !== undefined ||
        v.pricingMode !== undefined ||
        v.hourlyPrice !== undefined ||
        v.weeklyPrice !== undefined,
      { message: "Fournir au moins un tarif." }
    ),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as {
      itemId: string;
      dailyPrice?: number | null;
      pricingMode?: "daily" | "flat";
      hourlyPrice?: number | null;
      weeklyPrice?: number | null;
      confidence: Confidence;
    };
    findItem(draft, input.itemId);
    const patch: Partial<DraftItem> = { priceConfidence: input.confidence };
    if (input.dailyPrice !== undefined) patch.dailyPrice = input.dailyPrice;
    if (input.pricingMode !== undefined) patch.pricingMode = input.pricingMode;
    if (input.hourlyPrice !== undefined) patch.hourlyPrice = input.hourlyPrice;
    if (input.weeklyPrice !== undefined) patch.weeklyPrice = input.weeklyPrice;
    return {
      draft: patchItem(draft, input.itemId, patch),
      changes: [
        {
          kind: "item_updated",
          label: "Tarif mis à jour",
          itemId: input.itemId,
        },
      ],
      result: `Tarifs du bien ${input.itemId} mis à jour (${input.confidence}).`,
    };
  },
};

const setItemDeposit: ToolDefinition = {
  description:
    "Fixe la caution d'un bien en XPF (0 = pas de caution, confirmé par l'utilisateur).",
  schema: z.object({
    itemId: shortText,
    deposit: money,
    confidence: confidence,
  }),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as {
      itemId: string;
      deposit: number;
      confidence: Confidence;
    };
    findItem(draft, input.itemId);
    return {
      draft: patchItem(draft, input.itemId, {
        deposit: input.deposit,
        depositConfidence: input.confidence,
      }),
      changes: [
        {
          kind: "item_updated",
          label: "Caution mise à jour",
          itemId: input.itemId,
        },
      ],
      result: `Caution du bien ${input.itemId} : ${input.deposit} XPF.`,
    };
  },
};

const addDeliveryZone: ToolDefinition = {
  description:
    "Ajoute une zone de livraison (gratuite ou payante avec frais en XPF). Active la livraison.",
  schema: z.object({
    zone: shortText,
    free: z.boolean(),
    fee: money.optional(),
  }),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as {
      zone: string;
      free: boolean;
      fee?: number;
    };
    const exists =
      draft.delivery.freeZones.some(
        (zone) => zone.toLowerCase() === input.zone.toLowerCase()
      ) ||
      draft.delivery.paidZones.some(
        (zone) => zone.zone.toLowerCase() === input.zone.toLowerCase()
      );
    if (exists) {
      return {
        draft,
        changes: [],
        result: `Zone « ${input.zone} » déjà enregistrée.`,
      };
    }
    return {
      draft: {
        ...draft,
        delivery: {
          ...draft.delivery,
          enabled: true,
          freeZones: input.free
            ? [...draft.delivery.freeZones, input.zone]
            : draft.delivery.freeZones,
          paidZones: input.free
            ? draft.delivery.paidZones
            : [
                ...draft.delivery.paidZones,
                { zone: input.zone, fee: input.fee ?? null },
              ],
        },
      },
      changes: [{ kind: "delivery", label: "Zone de livraison détectée" }],
      result: `Zone « ${input.zone} » ajoutée (${input.free ? "gratuite" : "payante"}).`,
    };
  },
};

const updateDeliveryRules: ToolDefinition = {
  description:
    "Active/désactive la livraison ou complète ses règles. enabled=false quand l'utilisateur dit ne pas livrer.",
  schema: z.object({
    enabled: z.boolean().optional(),
    notes: z.string().trim().min(1).max(1000).optional(),
    clearZones: z.boolean().optional(),
  }),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as {
      enabled?: boolean;
      notes?: string;
      clearZones?: boolean;
    };
    return {
      draft: {
        ...draft,
        delivery: {
          enabled: input.enabled ?? draft.delivery.enabled,
          freeZones: input.clearZones ? [] : draft.delivery.freeZones,
          paidZones: input.clearZones ? [] : draft.delivery.paidZones,
          notes: input.notes ?? draft.delivery.notes,
        },
      },
      changes: [{ kind: "delivery", label: "Livraison mise à jour" }],
      result: "Règles de livraison mises à jour.",
    };
  },
};

const updateBookingRequirements: ToolDefinition = {
  description:
    "Fixe les règles de réservation : documents demandés ([] = aucun), durée minimale, préavis, moyens de paiement, conditions.",
  schema: z.object({
    requestedDocuments: z.array(shortText).max(20).optional(),
    minimumDurationDays: z.number().int().min(1).max(365).optional(),
    advanceNoticeHours: z.number().int().min(0).max(8760).optional(),
    paymentMethods: z.array(shortText).max(20).optional(),
    terms: z.string().trim().min(1).max(2000).optional(),
  }),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as Partial<
      OnboardingDraft["bookingRules"]
    >;
    if (Object.keys(input).length === 0) {
      throw new Error("Aucun champ fourni.");
    }
    return {
      draft: { ...draft, bookingRules: { ...draft.bookingRules, ...input } },
      changes: [{ kind: "rules", label: "Règles de réservation mises à jour" }],
      result: "Règles de réservation mises à jour.",
    };
  },
};

const markInformationAsMissing: ToolDefinition = {
  description:
    "Note une information importante encore manquante (affichée au loueur), ex. « tarif du Puzzi 8/1 ».",
  schema: z.object({
    topic: shortText,
    note: z.string().trim().max(500).optional(),
  }),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as { topic: string; note?: string };
    if (
      draft.missing.some(
        (m) => m.topic.toLowerCase() === input.topic.toLowerCase()
      )
    ) {
      return { draft, changes: [], result: "Déjà noté comme manquant." };
    }
    const id = nextTempId("m", draft.missing);
    return {
      draft: {
        ...draft,
        missing: [
          ...draft.missing,
          { id, topic: input.topic, note: input.note ?? "" },
        ],
      },
      changes: [{ kind: "missing", label: "Information manquante notée" }],
      result: `Manque ${id} noté : ${input.topic}.`,
    };
  },
};

const resolveAmbiguity: ToolDefinition = {
  description:
    "Marque une valeur comme confirmée par l'utilisateur (prix, caution ou quantité d'un bien) et/ou lève une information manquante (missingId).",
  schema: z
    .object({
      itemId: shortText.optional(),
      field: z.enum(["price", "deposit", "quantity"]).optional(),
      missingId: shortText.optional(),
    })
    .refine((v) => (v.itemId && v.field) || v.missingId, {
      message: "Fournir itemId+field ou missingId.",
    }),
  apply(draft, raw) {
    const input = this.schema.parse(raw) as {
      itemId?: string;
      field?: "price" | "deposit" | "quantity";
      missingId?: string;
    };
    let working = draft;
    const changes: DraftChange[] = [];
    if (input.itemId && input.field) {
      findItem(working, input.itemId);
      const key =
        input.field === "price"
          ? "priceConfidence"
          : input.field === "deposit"
            ? "depositConfidence"
            : "quantityConfidence";
      working = patchItem(working, input.itemId, { [key]: "confirmed" });
      changes.push({
        kind: "item_updated",
        label: "Valeur confirmée",
        itemId: input.itemId,
      });
    }
    if (input.missingId) {
      working = {
        ...working,
        missing: working.missing.filter((m) => m.id !== input.missingId),
      };
      changes.push({ kind: "missing", label: "Information complétée" });
    }
    return { draft: working, changes, result: "Ambiguïté levée." };
  },
};

const prepareReview: ToolDefinition = {
  description:
    "Propose au loueur de passer à l'écran de vérification quand le brouillon est suffisamment complet. N'importe rien : la validation reste humaine.",
  schema: z.object({}),
  apply(draft) {
    return {
      draft,
      changes: [{ kind: "review", label: "Prêt pour la vérification" }],
      result:
        "Vérification proposée : l'utilisateur voit un bouton « Vérifier mon activité ».",
    };
  },
};

export const AGENT_TOOLS: Record<string, ToolDefinition> = {
  updateBusinessInformation,
  addCategory,
  updateCategory,
  addRentalItem,
  updateRentalItem,
  removeRentalItem,
  setItemQuantity,
  setItemPricing,
  setItemDeposit,
  addDeliveryZone,
  updateDeliveryRules,
  updateBookingRequirements,
  markInformationAsMissing,
  resolveAmbiguity,
  prepareReview,
};
