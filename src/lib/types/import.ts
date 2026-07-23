// Types du parcours d'import (« Créer mon entreprise rapidement »).
// Une session d'import est un brouillon local : rien n'est écrit dans les
// données réelles avant la validation humaine de l'écran de vérification.

export type ImportSource =
  | "file"
  | "text"
  | "assistant"
  | "express"
  | "website"
  | "manual";

export type ImportStatus =
  | "draft"
  | "processing"
  | "ready_for_review"
  | "importing"
  | "completed"
  | "failed";

/** Fiabilité d'une valeur détectée automatiquement. */
export type FieldConfidence = "detected" | "probable" | "missing";

/**
 * stock : une fiche avec quantité (chaises, matériels identiques…)
 * individual : N fiches numérotées (véhicules, logements, biens immatriculés…)
 */
export type ItemTracking = "stock" | "individual";

export type DuplicateResolution = "create" | "skip" | "replace";

export type ParsedItem = {
  /** Identifiant local de la ligne (pas un id base de données). */
  id: string;
  name: string;
  /** Libellé de catégorie — résolu/créé au moment de l'import réel. */
  categoryName: string;
  tracking: ItemTracking;
  quantity: number;
  /** null = non détecté : jamais de prix inventé. */
  dailyPrice: number | null;
  /** "daily" : prix × durée ; "flat" : forfait (prestation, prix fixe). */
  pricingMode: "daily" | "flat";
  depositAmount: number | null;
  minRentalDays: number;
  internalRef: string;
  description: string;
  internalNotes: string;
  priceConfidence: FieldConfidence;
  depositConfidence: FieldConfidence;
  /** Id d'un matériel existant très similaire, le cas échéant. */
  duplicateOfId: string | null;
  duplicateOfName: string | null;
  duplicateResolution: DuplicateResolution;
  /** Ligne exclue de l'import par l'utilisateur. */
  excluded: boolean;
};

export type ParsedBusiness = {
  name: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  /** Zones desservies / règles de livraison, en texte libre. */
  deliveryNotes: string | null;
};

export type ImportSessionData = {
  id: string;
  source: ImportSource;
  status: ImportStatus;
  /** Entrée d'origine (texte collé, nom du fichier, URL…), pour reprise. */
  rawInput: string;
  business: ParsedBusiness;
  items: ParsedItem[];
  /** Catégories à créer même sans bien associé (parcours express). */
  extraCategories: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

// ------------------------------------------------------------
// Problèmes calculés (jamais stockés : dérivés de l'état courant)
// ------------------------------------------------------------

export type ItemIssueLevel = "error" | "warning" | "info";

export type ItemIssue = {
  level: ItemIssueLevel;
  code:
    | "missing_name"
    | "missing_price"
    | "probable_price"
    | "missing_category"
    | "probable_deposit"
    | "possible_duplicate"
    | "invalid_quantity";
  message: string;
};

export type ItemReviewState =
  | "ready"
  | "incomplete"
  | "duplicate"
  | "to_verify"
  | "error";

/** Rapport de l'import final. */
export type ImportReport = {
  createdCategories: number;
  createdItems: number;
  replacedItems: number;
  skippedItems: number;
  businessUpdated: boolean;
};
