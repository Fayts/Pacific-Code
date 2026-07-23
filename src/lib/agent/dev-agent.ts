// Agent de MODE DÉVELOPPEMENT : déterministe, sans appel réseau.
// Il n'est jamais présenté comme une IA (bandeau explicite côté UI) et
// n'existe que pour développer/tester le parcours sans clé. Il passe par
// les MÊMES outils/réducteurs que l'agent réel : le flux complet
// (outils → brouillon → validation → aperçu) est donc réellement exercé.

import {
  onboardingDraftSchema,
  type OnboardingDraft,
} from "@/lib/agent/draft";
import { AGENT_TOOLS, type DraftChange } from "@/lib/agent/tools";
import { computeCompleteness } from "@/lib/agent/completeness";
import { parseCatalogText } from "@/lib/import/text-parser";
import { parsePrice } from "@/lib/import/normalize";

export type AgentTurn = {
  reply: string;
  draft: OnboardingDraft;
  changes: DraftChange[];
  readyForReview: boolean;
};

const NEGATIVE = /^(non|no|aucun|aucune|rien|pas de|nope)\b/i;
const YES = /^(oui|yes|ok|c'est ça|exact|tout à fait|correct)\b/i;

function runTool(
  draft: OnboardingDraft,
  name: keyof typeof AGENT_TOOLS,
  input: unknown,
  changes: DraftChange[]
): OnboardingDraft {
  const applied = AGENT_TOOLS[name].apply(draft, input);
  changes.push(...applied.changes);
  return onboardingDraftSchema.parse(applied.draft);
}

/** Prochain besoin à couvrir, dans l'ordre métier. */
function nextNeed(draft: OnboardingDraft):
  | { kind: "name" }
  | { kind: "items" }
  | { kind: "price"; itemId: string; itemName: string }
  | { kind: "deposit" }
  | { kind: "delivery" }
  | { kind: "documents" }
  | { kind: "done" } {
  if (draft.items.length === 0) return { kind: "items" };
  const unpriced = draft.items.find(
    (i) =>
      i.dailyPrice === null && i.hourlyPrice === null && i.weeklyPrice === null
  );
  if (unpriced) {
    return { kind: "price", itemId: unpriced.id, itemName: unpriced.name };
  }
  if (!draft.business.name) return { kind: "name" };
  if (draft.items.some((i) => i.deposit === null)) return { kind: "deposit" };
  if (draft.delivery.enabled === null) return { kind: "delivery" };
  if (draft.bookingRules.requestedDocuments === null) {
    return { kind: "documents" };
  }
  return { kind: "done" };
}

function questionFor(draft: OnboardingDraft): string {
  const need = nextNeed(draft);
  switch (need.kind) {
    case "items":
      return "Que louez-vous, et en quelle quantité ? Par exemple : « deux Puzzi 10/1 et un Puzzi 8/1 ».";
    case "price":
      return `Quel est le tarif de location de « ${need.itemName} » ? (par jour, en XPF)`;
    case "name":
      return "Quel est le nom de votre entreprise ?";
    case "deposit":
      return "Demandez-vous une caution ? Si oui, de combien ?";
    case "delivery":
      return "Proposez-vous la livraison ? Dans quelles zones ?";
    case "documents":
      return "Quels documents demandez-vous à vos clients ? (ex. permis, pièce d'identité — ou « aucun »)";
    case "done":
      return "Votre brouillon est prêt — cliquez sur « Vérifier mon activité » pour tout contrôler avant l'import.";
  }
}

export function runDevAgent(
  message: string,
  draft: OnboardingDraft
): AgentTurn {
  const changes: DraftChange[] = [];
  let working = draft;
  let ack = "";
  const need = nextNeed(working);

  // 1. Le message contient-il des biens ? (analyse déterministe partagée)
  const parsed = parseCatalogText(message);
  if (parsed.items.length > 0) {
    for (const item of parsed.items) {
      working = runTool(
        working,
        "addRentalItem",
        {
          name: item.name,
          categoryName: item.categoryName || undefined,
          tracking: item.tracking,
          quantity: item.quantity,
          dailyPrice: item.dailyPrice ?? undefined,
          pricingMode: item.pricingMode,
          deposit: item.depositAmount ?? undefined,
          priceConfidence: item.dailyPrice !== null ? "probable" : "missing",
        },
        changes
      );
    }
    ack = `J'ai ajouté ${parsed.items.length} bien${parsed.items.length > 1 ? "s" : ""} au brouillon.`;
  } else if (need.kind === "price") {
    const amount = parsePrice(message);
    if (amount !== null && amount > 0) {
      working = runTool(
        working,
        "setItemPricing",
        { itemId: need.itemId, dailyPrice: amount, confidence: "verify" },
        changes
      );
      ack = `J'ai noté ${amount.toLocaleString("fr-FR")} XPF par jour pour « ${need.itemName} » — à confirmer.`;
    } else if (YES.test(message.trim())) {
      ack = "Très bien.";
    } else {
      working = runTool(
        working,
        "markInformationAsMissing",
        { topic: `Tarif de ${need.itemName}` },
        changes
      );
      ack = "Je n'ai pas identifié de montant — je le note comme manquant.";
    }
  } else if (need.kind === "name") {
    working = runTool(
      working,
      "updateBusinessInformation",
      { name: message.trim().slice(0, 200) },
      changes
    );
    ack = "Nom de l'entreprise enregistré.";
  } else if (need.kind === "deposit") {
    if (NEGATIVE.test(message.trim())) {
      for (const item of working.items) {
        if (item.deposit === null) {
          working = runTool(
            working,
            "setItemDeposit",
            { itemId: item.id, deposit: 0, confidence: "confirmed" },
            changes
          );
        }
      }
      ack = "Compris : aucune caution.";
    } else {
      const amount = parsePrice(message);
      if (amount !== null && amount > 0) {
        for (const item of working.items) {
          if (item.deposit === null) {
            working = runTool(
              working,
              "setItemDeposit",
              { itemId: item.id, deposit: amount, confidence: "probable" },
              changes
            );
          }
        }
        ack = `Caution de ${amount.toLocaleString("fr-FR")} XPF appliquée — à vérifier bien par bien.`;
      } else {
        ack = "Je n'ai pas identifié de montant de caution.";
      }
    }
  } else if (need.kind === "delivery") {
    if (NEGATIVE.test(message.trim())) {
      working = runTool(
        working,
        "updateDeliveryRules",
        { enabled: false },
        changes
      );
      ack = "Compris : pas de livraison.";
    } else {
      working = runTool(
        working,
        "updateDeliveryRules",
        { enabled: true, notes: message.trim().slice(0, 1000) },
        changes
      );
      ack = "Zones de livraison notées.";
    }
  } else if (need.kind === "documents") {
    const documents = NEGATIVE.test(message.trim())
      ? []
      : message
          .split(/,|\bet\b/i)
          .map((d) => d.trim())
          .filter((d) => d.length > 1 && d.length <= 200)
          .slice(0, 20);
    working = runTool(
      working,
      "updateBookingRequirements",
      { requestedDocuments: documents },
      changes
    );
    ack =
      documents.length > 0
        ? `Documents demandés : ${documents.join(", ")}.`
        : "Compris : aucun document demandé.";
  } else {
    ack = "C'est noté.";
  }

  const completeness = computeCompleteness(working);
  if (completeness.readyForReview && nextNeed(working).kind === "done") {
    working = runTool(working, "prepareReview", {}, changes);
  }

  return {
    reply: [ack, questionFor(working)].filter(Boolean).join(" "),
    draft: working,
    changes,
    readyForReview: changes.some((c) => c.kind === "review"),
  };
}
