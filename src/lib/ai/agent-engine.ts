// Moteur de l'Agent IA commercial (mode démonstration) : analyse
// déterministe des messages entrants en français, consultation du
// catalogue / des disponibilités / des tarifs via la couche Repository,
// et rédaction d'une réponse selon le ton configuré.
//
// Règle d'or : l'agent ne répond JAMAIS au hasard. Chaque chiffre vient
// des données (catalogue, disponibilités, réglages) ; ce qu'il ne sait
// pas, il le demande ou le transmet au loueur.
//
// Demain, un mode LLM pourra remplacer l'extraction (intention, bien,
// dates) sans changer ni la forme de l'analyse ni l'interface.

import type { DataProvider } from "@/lib/data/repositories";
import type { EquipmentItem, Organization } from "@/lib/types/database";
import type {
  AgentSettings,
  InboxConversation,
  InboxMessage,
} from "@/lib/types/inbox";
import {
  parseLocalDateTimeInput,
  utcToZonedParts,
  zonedTimeToUtc,
} from "@/lib/core/dates";
import { computeBookingTotals, computeDurationDays } from "@/lib/core/pricing";
import { formatCustomerName, formatMoney } from "@/lib/core/format";

// ------------------------------------------------------------
// Types de l'analyse
// ------------------------------------------------------------

export type AgentIntent =
  | "rental_request"
  | "price_question"
  | "availability_question"
  | "practical_question"
  | "complaint"
  | "cancellation"
  | "discount_request"
  | "other";

export type AgentPeriod = {
  /** Heure locale de l'organisation, format yyyy-MM-ddTHH:mm. */
  startAt: string;
  endAt: string;
  label: string;
};

export type AgentAnalysis = {
  intent: AgentIntent;
  complexity: "simple" | "complex";
  equipment: { id: string; name: string; dailyPrice: number; deposit: number } | null;
  /** Autres matériels plausibles (ambiguïté ou suggestion). */
  candidates: { id: string; name: string }[];
  period: AgentPeriod | null;
  durationDays: number | null;
  availability: {
    available: boolean;
    reason: string | null;
    availableQuantity: number;
  } | null;
  pricing: { total: number; deposit: number } | null;
  customer: { id: string; name: string } | null;
  missing: string[];
  draftReply: string;
  /** Réponse envoyable sans validation (mode auto + demande simple complète). */
  autoSendable: boolean;
};

// ------------------------------------------------------------
// Normalisation et détection d'intention
// ------------------------------------------------------------

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(new RegExp("[\\u2019\\u2018]", "g"), "'");
}

const COMPLAINT = /mecontent|insatisfait|probleme|panne|casse|arrete de fonctionner|ne fonctionne (plus|pas)|plainte|reclamation|inadmissible/;
const CANCELLATION = /annul/;
const DISCOUNT = /remise|reduction|geste commercial|rembours/;
const RENTAL = /\b(re)?lou(e|er|ez|ons)\b|\blocation\b|\breserv\w*/;
const PRICE = /combien|tarif|\bprix\b|ca coute|cout\b/;
const AVAILABILITY = /\bdispo\b|disponible|disponibilite/;
const PRACTICAL = /horaire|ouvert|ouverture|adresse|ou etes-vous|retrait|livraison|livrez/;

function detectIntent(t: string): AgentIntent {
  if (COMPLAINT.test(t)) return "complaint";
  if (CANCELLATION.test(t)) return "cancellation";
  if (DISCOUNT.test(t)) return "discount_request";
  if (RENTAL.test(t)) return "rental_request";
  if (PRICE.test(t)) return "price_question";
  if (AVAILABILITY.test(t)) return "availability_question";
  if (PRACTICAL.test(t)) return "practical_question";
  return "other";
}

// ------------------------------------------------------------
// Extraction du matériel (correspondance floue avec le catalogue)
// ------------------------------------------------------------

/** Score minimal pour désigner un matériel avec confiance. */
const MIN_CONFIDENT_SCORE = 3;

function tokens(value: string, minLength = 2): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= minLength);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsWord(text: string, token: string): boolean {
  return new RegExp(`\\b${escapeRegExp(token)}\\b`).test(text);
}

function scoreEquipment(
  t: string,
  item: EquipmentItem,
  categoryText: string
): number {
  let score = 0;
  const name = normalize(item.name);
  if (t.includes(name)) score += 10;
  for (const token of tokens(item.name, 1)) {
    if (containsWord(t, token)) score += 3;
  }
  if (item.internal_ref && containsWord(t, normalize(item.internal_ref))) {
    score += 5;
  }
  for (const token of new Set(tokens(categoryText, 4))) {
    if (containsWord(t, token)) score += 1;
  }
  for (const token of new Set(tokens(item.description ?? "", 4))) {
    if (containsWord(t, token)) score += 0.5;
  }
  return score;
}

// ------------------------------------------------------------
// Extraction de la période (jours + moments de la journée)
// ------------------------------------------------------------

const WEEKDAYS: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

const DAY_PATTERN = new RegExp(
  "(aujourd ?'?hui|apres[- ]demain|demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)" +
    "(?:\\s+(matin|midi|apres[- ]midi|soir))?",
  "g"
);

type DayPart = "matin" | "midi" | "apres-midi" | "soir" | null;

type DayToken = { deltaFromNow: number | null; weekday: number | null; part: DayPart };

const START_HOURS: Record<string, number> = {
  matin: 8,
  midi: 12,
  "apres-midi": 13,
  soir: 18,
};
const END_HOURS: Record<string, number> = {
  matin: 12,
  midi: 14,
  "apres-midi": 17,
  soir: 18,
};

function localDayParts(now: Date, timeZone: string, plusDays: number) {
  const p = utcToZonedParts(now, timeZone);
  const noon = zonedTimeToUtc(
    { year: p.year, month: p.month, day: p.day + plusDays, hour: 12, minute: 0 },
    timeZone
  );
  return utcToZonedParts(noon, timeZone);
}

function weekdayInTimeZone(now: Date, timeZone: string): number {
  const p = utcToZonedParts(now, timeZone);
  return zonedTimeToUtc(
    { year: p.year, month: p.month, day: p.day, hour: 12, minute: 0 },
    timeZone
  ).getUTCDay();
}

function toLocalString(
  parts: { year: number; month: number; day: number },
  hour: number
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(hour)}:00`;
}

export function parseRequestPeriod(
  text: string,
  timeZone: string,
  now: Date = new Date()
): AgentPeriod | null {
  const t = normalize(text);
  const found: DayToken[] = [];
  DAY_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DAY_PATTERN.exec(t)) !== null && found.length < 2) {
    const word = match[1].replace(/\s+/g, " ");
    const part = (match[2]?.replace(/\s+/g, "-") ?? null) as DayPart;
    if (/aujourd/.test(word)) {
      found.push({ deltaFromNow: 0, weekday: null, part });
    } else if (/apres[- ]demain/.test(word)) {
      found.push({ deltaFromNow: 2, weekday: null, part });
    } else if (word === "demain") {
      found.push({ deltaFromNow: 1, weekday: null, part });
    } else {
      found.push({ deltaFromNow: null, weekday: WEEKDAYS[word] ?? null, part });
    }
  }
  if (found.length === 0) return null;

  const today = weekdayInTimeZone(now, timeZone);
  const deltaOf = (token: DayToken, notBefore: number): number => {
    if (token.deltaFromNow !== null) return token.deltaFromNow;
    let delta = ((token.weekday ?? 0) - today + 7) % 7;
    if (delta === 0 && notBefore === 0) delta = 7; // « samedi » un samedi = le prochain
    while (delta < notBefore) delta += 7;
    return delta;
  };

  const startToken = found[0];
  const startDelta = deltaOf(startToken, 0);
  const startHour = startToken.part ? START_HOURS[startToken.part] : 8;
  const startParts = localDayParts(now, timeZone, startDelta);

  let endDelta = startDelta;
  let endHour: number;
  if (found.length > 1) {
    const endToken = found[1];
    endDelta = deltaOf(endToken, startDelta);
    if (endDelta === startDelta && endToken.weekday !== null) {
      // « de samedi à samedi » : une semaine complète.
      endDelta = startDelta + (endToken.weekday === startToken.weekday ? 7 : 0);
    }
    endHour = endToken.part ? END_HOURS[endToken.part] : 17;
  } else {
    endHour = 17;
    if (startHour >= endHour) endHour = Math.min(startHour + 3, 23);
  }
  const endParts = localDayParts(now, timeZone, endDelta);

  const pad = (n: number) => String(n).padStart(2, "0");
  const label =
    startDelta === endDelta
      ? `le ${pad(startParts.day)}/${pad(startParts.month)}`
      : `du ${pad(startParts.day)}/${pad(startParts.month)} au ${pad(endParts.day)}/${pad(endParts.month)}`;

  return {
    startAt: toLocalString(startParts, startHour),
    endAt: toLocalString(endParts, endHour),
    label,
  };
}

/** « 2026-07-25T08:00 » → « samedi 25/07 à 8 h». */
function humanDateTime(local: string): string {
  const [date, time] = local.split("T");
  const [, month, day] = date.split("-");
  const [hour, minute] = time.split(":");
  const h = Number(hour);
  const suffix = minute !== "00" ? ` ${minute}` : "";
  return `${day}/${month} à ${h} h${suffix}`;
}

// ------------------------------------------------------------
// Rédaction selon le ton
// ------------------------------------------------------------

const TONE_TEMPLATES: Record<
  AgentSettings["tone"],
  { greeting: string; closing: string }
> = {
  professional: { greeting: "Bonjour,", closing: "Cordialement," },
  warm: { greeting: "Bonjour 👋", closing: "À très bientôt !" },
  concise: { greeting: "Bonjour,", closing: "" },
  premium: {
    greeting: "Bonjour,",
    closing: "Nous restons à votre entière disposition.",
  },
};

function assembleReply(
  settings: AgentSettings,
  paragraphs: string[]
): string {
  const tone = TONE_TEMPLATES[settings.tone];
  const parts = [tone.greeting, ...paragraphs.filter(Boolean)];
  if (tone.closing) parts.push(tone.closing);
  if (settings.signature.trim()) parts.push(settings.signature.trim());
  return parts.join("\n\n");
}

// ------------------------------------------------------------
// Analyse complète d'une conversation
// ------------------------------------------------------------

export type AgentAnalysisDeps = {
  provider: DataProvider;
  organization: Organization;
  settings: AgentSettings;
  /** Lien du formulaire officiel de réservation. */
  formUrl?: string;
  now?: Date;
};

export async function analyzeConversation(
  input: { conversation: InboxConversation; messages: InboxMessage[] },
  deps: AgentAnalysisDeps
): Promise<AgentAnalysis> {
  const { conversation, messages } = input;
  const { provider, organization, settings } = deps;
  const now = deps.now ?? new Date();
  const formUrl = deps.formUrl ?? "/reserver/apercu";
  const timeZone = organization.timezone;
  const currency = organization.currency;

  const inboundText = [
    conversation.subject ?? "",
    ...messages
      .filter((m) => m.direction === "inbound")
      .map((m) => m.body),
  ].join("\n");
  const t = normalize(inboundText);

  const intent = detectIntent(t);
  const complexity =
    intent === "complaint" ||
    intent === "cancellation" ||
    intent === "discount_request"
      ? "complex"
      : "simple";

  // --- Matériel ---
  const [equipmentList, categories] = await Promise.all([
    provider.equipment.list(),
    provider.categories.list(),
  ]);
  const categoryText = new Map(
    categories.map((c) => [c.id, `${c.name} ${c.description ?? ""}`])
  );
  const scored = equipmentList
    .map((item) => ({
      item,
      score: scoreEquipment(
        t,
        item,
        item.category_id ? (categoryText.get(item.category_id) ?? "") : ""
      ),
    }))
    .filter((s) => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.item.quantity_total - a.item.quantity_total ||
        a.item.daily_price - b.item.daily_price ||
        a.item.name.localeCompare(b.item.name)
    );

  const topScore = scored[0]?.score ?? 0;
  const confident = topScore >= MIN_CONFIDENT_SCORE;
  const equipmentRow = confident ? scored[0].item : null;
  const candidates = scored
    .filter((s) => s.item.id !== equipmentRow?.id)
    .slice(0, 3)
    .map((s) => ({ id: s.item.id, name: s.item.name }));

  // --- Période ---
  const period = parseRequestPeriod(inboundText, timeZone, now);
  let durationDays: number | null = null;
  if (period) {
    try {
      durationDays = computeDurationDays(
        parseLocalDateTimeInput(period.startAt, timeZone),
        parseLocalDateTimeInput(period.endAt, timeZone)
      );
    } catch {
      durationDays = null;
    }
  }

  // --- Disponibilité et prix ---
  let availability: AgentAnalysis["availability"] = null;
  let pricing: AgentAnalysis["pricing"] = null;
  if (equipmentRow && period && durationDays) {
    const result = await provider.bookings.checkAvailability({
      equipmentId: equipmentRow.id,
      startAtIso: parseLocalDateTimeInput(period.startAt, timeZone).toISOString(),
      endAtIso: parseLocalDateTimeInput(period.endAt, timeZone).toISOString(),
      quantity: 1,
    });
    availability = {
      available: result.available,
      reason: result.reason ?? null,
      availableQuantity: result.available_quantity,
    };
    const totals = computeBookingTotals({
      items: [{ dailyPrice: equipmentRow.daily_price, quantity: 1 }],
      durationDays,
    });
    pricing = { total: totals.total, deposit: equipmentRow.deposit_amount };
  }

  // --- Client ---
  let customer: AgentAnalysis["customer"] = null;
  if (conversation.customer_id) {
    const row = await provider.customers.get(conversation.customer_id);
    if (row) customer = { id: row.id, name: formatCustomerName(row) };
  }
  if (!customer && conversation.customer_contact) {
    const contact = conversation.customer_contact.trim().toLowerCase();
    const row = (await provider.customers.list()).find(
      (c) => c.email && c.email.toLowerCase() === contact
    );
    if (row) customer = { id: row.id, name: formatCustomerName(row) };
  }

  // --- Informations manquantes ---
  const missing: string[] = [];
  const rentalLike =
    intent === "rental_request" ||
    intent === "price_question" ||
    intent === "availability_question";
  if (rentalLike && !equipmentRow) {
    missing.push(
      candidates.length > 0
        ? `le modèle exact (${candidates.map((c) => c.name).join(" ou ")})`
        : "le matériel souhaité"
    );
  }
  if (intent === "rental_request" && !period) {
    missing.push("les dates et horaires de location");
  }
  if (!customer) {
    missing.push("les coordonnées complètes du client (via le formulaire)");
  }

  // --- Rédaction ---
  const money = (n: number) => formatMoney(n, currency);
  const formInvite = settings.permissions.send_form
    ? `Pour finaliser votre réservation, merci de compléter notre formulaire : ${formUrl}`
    : "";
  const paragraphs: string[] = [];
  let autoSendable = false;

  if (complexity === "complex") {
    if (intent === "complaint") {
      paragraphs.push(
        "Nous sommes sincèrement désolés pour ce désagrément. Votre message a été transmis immédiatement au responsable, qui vous recontacte au plus vite pour trouver une solution."
      );
    } else if (intent === "cancellation") {
      paragraphs.push(
        "Nous avons bien reçu votre demande d'annulation. Elle a été transmise au responsable, qui revient vers vous rapidement pour la confirmer."
      );
    } else {
      paragraphs.push(
        "Nous avons bien reçu votre demande. Elle a été transmise au responsable, qui revient vers vous rapidement."
      );
    }
  } else if (intent === "price_question" && equipmentRow) {
    // Question de tarif : toujours donner le prix, puis l'état de dispo.
    paragraphs.push(
      `Le ${equipmentRow.name} est à ${money(equipmentRow.daily_price)} la journée, avec une caution de ${money(equipmentRow.deposit_amount)}.`
    );
    if (availability && period) {
      if (availability.available) {
        paragraphs.push(
          `Il est disponible ${period.label}${
            pricing && durationDays && durationDays > 1
              ? ` — soit ${money(pricing.total)} pour ${durationDays} jours`
              : ""
          }.`
        );
        if (formInvite) paragraphs.push(formInvite);
      } else if (availability.reason === "maintenance") {
        paragraphs.push(
          "Il est actuellement en maintenance : nous vous prévenons dès qu'il est de nouveau disponible."
        );
      } else {
        paragraphs.push(
          `Il est déjà réservé ${period.label}. Souhaitez-vous d'autres dates ?`
        );
      }
    } else if (equipmentRow.status === "maintenance") {
      paragraphs.push(
        "Il est actuellement en maintenance : nous vous prévenons dès qu'il est de nouveau disponible."
      );
    } else if (formInvite) {
      paragraphs.push(
        `Indiquez-nous vos dates pour vérifier la disponibilité, ou réservez directement : ${formUrl}`
      );
    }
    autoSendable = true;
  } else if (rentalLike && equipmentRow && period && pricing && availability) {
    if (availability.available) {
      paragraphs.push(
        `Le ${equipmentRow.name} est disponible du ${humanDateTime(period.startAt)} au ${humanDateTime(period.endAt)}.`
      );
      paragraphs.push(
        `Le tarif est de ${money(pricing.total)} pour ${durationDays} jour${(durationDays ?? 0) > 1 ? "s" : ""} de location, avec une caution de ${money(pricing.deposit)}.`
      );
      if (formInvite) paragraphs.push(formInvite);
      autoSendable = true;
    } else {
      const reason =
        availability.reason === "maintenance"
          ? `Le ${equipmentRow.name} est actuellement en maintenance : nous ne pouvons malheureusement pas le proposer sur ces dates.`
          : availability.reason === "conflict"
            ? `Le ${equipmentRow.name} est déjà réservé sur ces dates (${period.label}).`
            : `Le ${equipmentRow.name} n'est pas disponible sur ces dates.`;
      paragraphs.push(reason);
      paragraphs.push(
        "Souhaitez-vous d'autres dates ? Indiquez-nous vos préférences et nous vérifions immédiatement."
      );
      autoSendable = true;
    }
  } else if (intent === "availability_question" && equipmentRow) {
    paragraphs.push(
      `Le ${equipmentRow.name} est à ${money(equipmentRow.daily_price)} la journée, avec une caution de ${money(equipmentRow.deposit_amount)}.`
    );
    if (equipmentRow.status === "maintenance") {
      paragraphs.push(
        "Il est actuellement en maintenance : nous vous prévenons dès qu'il est de nouveau disponible."
      );
    } else if (formInvite) {
      paragraphs.push(
        `Indiquez-nous vos dates pour vérifier la disponibilité, ou réservez directement : ${formUrl}`
      );
    }
    autoSendable = true;
  } else if (intent === "practical_question") {
    if (settings.practical_info.trim()) {
      paragraphs.push(settings.practical_info.trim());
      autoSendable = true;
    } else {
      paragraphs.push(
        "Nous transmettons votre question et revenons vers vous très rapidement."
      );
    }
  } else {
    // Demande incomplète ou hors périmètre : demander les précisions.
    if (missing.length > 0 && rentalLike) {
      if (candidates.length > 0 && !equipmentRow) {
        paragraphs.push(
          `Nous avons bien ce qu'il vous faut ! Pour vous répondre précisément, pouvez-vous préciser ${missing.join(", ")} ?`
        );
        paragraphs.push(
          `Nos modèles : ${candidates.map((c) => c.name).join(", ")}.`
        );
      } else {
        paragraphs.push(
          `Merci pour votre message ! Pour vous répondre précisément, pouvez-vous préciser ${missing.join(", ")} ?`
        );
      }
      if (formInvite) paragraphs.push(formInvite);
    } else {
      paragraphs.push(
        "Merci pour votre message ! Pouvez-vous préciser le matériel souhaité et vos dates de location ?"
      );
      if (formInvite) paragraphs.push(formInvite);
    }
  }

  const draftReply = assembleReply(settings, paragraphs);

  const agentActive = settings.activated_at !== null;
  const finalAutoSendable =
    autoSendable &&
    agentActive &&
    settings.mode === "auto" &&
    settings.permissions.auto_reply_simple &&
    complexity === "simple";

  return {
    intent,
    complexity,
    equipment: equipmentRow
      ? {
          id: equipmentRow.id,
          name: equipmentRow.name,
          dailyPrice: equipmentRow.daily_price,
          deposit: equipmentRow.deposit_amount,
        }
      : null,
    candidates,
    period,
    durationDays,
    availability,
    pricing,
    customer,
    missing,
    draftReply,
    autoSendable: finalAutoSendable,
  };
}
