// Conversion d'une conversation « mûre » en réservation préremplie.
// Le moteur d'analyse (règles + vraies données, zéro IA) fournit le bien,
// la période et la disponibilité ; ici on décide si la demande est « prête
// à réserver », on retrouve ou crée le client du carnet, et on transmet le
// préremplissage au formulaire de réservation via sessionStorage
// (consommé une seule fois). Rien n'est réservé sans validation humaine.

import {
  analyzeConversation,
  type AgentAnalysis,
  type AgentAnalysisDeps,
} from "@/lib/ai/agent-engine";
import type { DataProvider } from "@/lib/data/repositories";
import type { InboxConversation } from "@/lib/types/inbox";
import { CHANNEL_LABELS } from "@/lib/core/labels";

export type BookingPrefill = {
  v: 1;
  conversationId: string;
  customerId: string;
  items: Array<{ equipmentId: string; quantity: number }>;
  /** datetime-local dans le fuseau de l'organisation. */
  startAt: string;
  endAt: string;
  depositAmount: number;
  notes: string;
};

const STORAGE_KEY = "pacific-code:booking-prefill";

/** Statuts de conversation encore « ouverts » pour la conversion. */
export const OPEN_STATUSES = ["new", "replied", "auto_replied"] as const;

/**
 * La demande est-elle prête à devenir une réservation ?
 * Bien identifié + période comprise + disponibilité confirmée.
 */
export function isReadyToBook(analysis: AgentAnalysis | null): boolean {
  return Boolean(
    analysis &&
      analysis.equipment &&
      analysis.period &&
      analysis.durationDays &&
      analysis.availability?.available &&
      ["rental_request", "availability_question", "price_question"].includes(
        analysis.intent
      )
  );
}

/** Client de la conversation : identifié par l'analyse, l'e-mail, ou créé. */
async function resolveCustomerId(
  conversation: InboxConversation,
  analysis: AgentAnalysis,
  provider: DataProvider
): Promise<string> {
  if (analysis.customer) return analysis.customer.id;

  const contact = conversation.customer_contact ?? "";
  const email = contact.startsWith("email:")
    ? contact.slice("email:".length).toLowerCase()
    : "";
  if (email) {
    const customers = await provider.customers.list();
    const match = customers.find(
      (c) => (c.email ?? "").toLowerCase() === email
    );
    if (match) return match.id;
  }

  // Fiche minimale créée depuis la conversation — complétable ensuite.
  const name = conversation.customer_name.trim() || "Client";
  const [firstName, ...rest] = name.split(/\s+/);
  const created = await provider.customers.create({
    type: "individual",
    firstName: firstName || name,
    lastName: rest.join(" "),
    companyName: "",
    email,
    phone: "",
    address: "",
    idNumber: "",
    internalNotes: `Fiche créée depuis une conversation ${CHANNEL_LABELS[conversation.channel]}.`,
  });
  return created.id;
}

/**
 * Prépare le préremplissage (client trouvé ou créé) et le range pour le
 * formulaire « Nouvelle réservation ». Renvoie false si l'analyse n'est
 * pas prête.
 */
export async function prepareBookingConversion(
  conversation: InboxConversation,
  analysis: AgentAnalysis,
  provider: DataProvider
): Promise<boolean> {
  if (!isReadyToBook(analysis) || !analysis.equipment || !analysis.period) {
    return false;
  }
  const customerId = await resolveCustomerId(conversation, analysis, provider);
  const prefill: BookingPrefill = {
    v: 1,
    conversationId: conversation.id,
    customerId,
    items: [{ equipmentId: analysis.equipment.id, quantity: 1 }],
    startAt: analysis.period.startAt,
    endAt: analysis.period.endAt,
    depositAmount: analysis.pricing?.deposit ?? analysis.equipment.deposit,
    notes: `Demande reçue via ${CHANNEL_LABELS[conversation.channel]} — ${conversation.customer_name}.`,
  };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefill));
  } catch {
    return false;
  }
  return true;
}

/** Lit puis efface le préremplissage (une seule consommation). */
export function consumeBookingPrefill(): BookingPrefill | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as BookingPrefill;
    if (
      parsed?.v !== 1 ||
      !parsed.customerId ||
      !Array.isArray(parsed.items) ||
      parsed.items.length === 0
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export type ReadyRequest = {
  conversation: InboxConversation;
  analysis: AgentAnalysis;
};

/**
 * Conversations ouvertes prêtes à convertir (widget du tableau de bord).
 * Analyse locale (règles + repos) — aucune IA, aucun crédit.
 */
export async function findReadyRequests(
  deps: AgentAnalysisDeps,
  limit = 6
): Promise<ReadyRequest[]> {
  const conversations = await deps.provider.inbox.listConversations();
  const open = conversations
    .filter((c) => (OPEN_STATUSES as readonly string[]).includes(c.status))
    .slice(0, 12);

  const results: ReadyRequest[] = [];
  for (const conversation of open) {
    if (results.length >= limit) break;
    try {
      const messages = await deps.provider.inbox.listMessages(conversation.id);
      const analysis = await analyzeConversation(
        { conversation, messages },
        deps
      );
      if (isReadyToBook(analysis)) results.push({ conversation, analysis });
    } catch {
      // Conversation illisible : ignorée, le widget reste utile.
    }
  }
  return results;
}
