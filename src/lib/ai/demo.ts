// Mode démonstration de l'assistant : les questions courantes reçoivent
// des réponses déterministes construites à partir des données de
// l'organisation, via des exécuteurs d'outils interchangeables (mock
// aujourd'hui, LLM + vraie source de données demain). Ce module est pur :
// aucune dépendance à une source de données concrète.

import type { AssistantProposal, BookingProposal } from "@/lib/ai/proposals";
import { resolvePeriodFr } from "@/lib/ai/dates-fr";
import { toLocalDateTimeInput, dayRangeInTimeZone } from "@/lib/core/dates";
import { formatMoney } from "@/lib/core/format";

export type DemoResult = {
  text: string;
  proposals: AssistantProposal[];
};

// Contrat minimal dont le moteur de démo a besoin — n'importe quelle
// implémentation (mock, Supabase…) peut le satisfaire.
export type DemoOrgContext = {
  organization: { timezone: string; currency: string };
};

export type DemoExecutors = {
  searchEquipment(input: {
    query?: string;
    status?: "available" | "maintenance" | "unavailable" | "all";
  }): Promise<{ id: string; name: string; reference: string | null }[]>;
  listAvailability(input: { startAt: string; endAt: string }): Promise<
    { equipmentId: string; name: string; total: number; available: number }[]
  >;
  searchCustomers(input: {
    query: string;
  }): Promise<{ id: string; name: string }[]>;
  listBookings(input: {
    filter: "all" | "upcoming" | "in_progress" | "late" | "pending" | "completed";
    startAt?: string;
    endAt?: string;
  }): Promise<
    {
      number: string;
      status: string;
      customer: string;
      startAt: string;
      endAt: string;
      total: string;
      equipment: string;
    }[]
  >;
  getStats(input: { startAt: string; endAt: string }): Promise<{
    bookingsCount: number;
    revenue: string;
    topEquipment: { name: string; revenue: string }[];
  }>;
  proposeBooking(input: {
    customerId: string;
    items: { equipmentId: string; quantity: number }[];
    startAt: string;
    endAt: string;
    notes?: string;
  }): Promise<BookingProposal | { error: string }>;
};

export type DemoToolkit = { executors: DemoExecutors };

const HELP_TEXT = `Je suis en **mode démonstration** : je réponds à des questions types avec les données de votre espace. Essayez par exemple :

- « Quels matériels sont disponibles samedi ? »
- « Quelles sont les locations prévues demain ? »
- « Quelles locations sont en retard ? »
- « Combien de réservations avons-nous ce mois-ci ? »
- « Quel matériel a généré le plus de chiffre d'affaires ce mois-ci ? »
- « Quels matériels sont en maintenance ? »
- « Crée une réservation pour Jean demain avec la Puzzi 10/1 »

Les réponses libres arriveront avec la connexion à un vrai modèle (Claude, OpenAI ou Gemini) dans la version en ligne — sans changer cette interface.`;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export async function runDemoAssistant(
  context: DemoOrgContext,
  toolkit: DemoToolkit,
  message: string,
  now: Date = new Date()
): Promise<DemoResult> {
  const t = normalize(message);
  const timezone = context.organization.timezone;
  const currency = context.organization.currency;
  const { executors } = toolkit;

  // --- Préparation de réservation : « crée une réservation pour X ... avec Y »
  const bookingMatch = message.match(
    /r[ée]serv\w*\s+pour\s+(.+?)\s+(aujourd'hui|demain|apr[èe]s[- ]demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*avec\s+(?:la |le |l'|les |un |une )?(.+?)[.?!]?$/i
  );
  if (/cr[ée]e|cr[ée]er|pr[ée]pare|nouvelle r[ée]servation/.test(t) && bookingMatch) {
    const customerQuery = bookingMatch[1].trim();
    const dateText = bookingMatch[2] ?? "demain";
    const equipmentQuery = bookingMatch[3].trim();

    const customers = await executors.searchCustomers({ query: customerQuery });
    if (customers.length === 0) {
      return {
        text: `Je n'ai trouvé aucun client correspondant à « ${customerQuery} ». Créez-le d'abord dans la page Clients, puis reformulez la demande.`,
        proposals: [],
      };
    }
    const equipment = await executors.searchEquipment({ query: equipmentQuery });
    if (equipment.length === 0) {
      return {
        text: `Je n'ai trouvé aucun matériel correspondant à « ${equipmentQuery} ».`,
        proposals: [],
      };
    }

    const period = resolvePeriodFr(dateText, timezone, now) ??
      resolvePeriodFr("demain", timezone, now)!;
    // Journée type : 08:00 → 18:00 locale.
    const dayStart = period.start;
    const startLocal = toLocalDateTimeInput(dayStart, timezone).slice(0, 10) + "T08:00";
    const endLocal = toLocalDateTimeInput(dayStart, timezone).slice(0, 10) + "T18:00";

    const proposal = await executors.proposeBooking({
      customerId: customers[0].id,
      items: [{ equipmentId: equipment[0].id, quantity: 1 }],
      startAt: startLocal,
      endAt: endLocal,
    });

    if ("error" in proposal) {
      return { text: `Impossible de préparer la réservation : ${proposal.error}`, proposals: [] };
    }

    const warnings = proposal.summary.warnings.length
      ? `\n\n⚠️ ${proposal.summary.warnings.join(" ; ")}`
      : "";
    return {
      text: `Je vais créer la réservation suivante :\n\n- Client : ${proposal.summary.customerName}\n- Matériel : ${proposal.summary.items.map((i) => i.equipmentName).join(", ")}\n- Départ : ${dateText} à 8 h\n- Retour : ${dateText} à 18 h\n- Prix estimé : ${formatMoney(proposal.summary.total, currency)}\n- Caution : ${formatMoney(proposal.summary.deposit, currency)}${warnings}\n\nConfirmez la création ci-dessous.`,
      proposals: [proposal],
    };
  }

  // --- Disponibilités : « quels matériels sont disponibles samedi ? »
  if (/disponib/.test(t)) {
    const period =
      resolvePeriodFr(message, timezone, now) ??
      ({ ...dayRangeInTimeZone(now, timezone), label: "aujourd'hui" });
    const rows = await executors.listAvailability({
      startAt: toLocalDateTimeInput(period.start, timezone),
      endAt: toLocalDateTimeInput(period.end, timezone),
    });
    const available = rows.filter((r) => r.available > 0);
    if (available.length === 0) {
      return {
        text: `Aucun matériel n'est disponible ${period.label}.`,
        proposals: [],
      };
    }
    return {
      text:
        `Matériels disponibles ${period.label} :\n\n` +
        available
          .map((r) => `- ${r.name} (${r.available}/${r.total} exemplaire${r.total > 1 ? "s" : ""})`)
          .join("\n"),
      proposals: [],
    };
  }

  // --- Retards
  if (/retard/.test(t)) {
    const late = await executors.listBookings({ filter: "late" });
    if (late.length === 0) {
      return { text: "Bonne nouvelle : aucune location n'est en retard. ✅", proposals: [] };
    }
    return {
      text:
        `Locations en retard :\n\n` +
        late
          // endAt est déjà une heure locale "yyyy-MM-ddTHH:mm".
          .map((b) => `- ${b.number} — ${b.customer} (retour prévu ${b.endAt.replace("T", " à ")}) : ${b.equipment}`)
          .join("\n"),
      proposals: [],
    };
  }

  // --- Maintenance
  if (/maintenance/.test(t)) {
    const items = await executors.searchEquipment({ status: "maintenance" });
    if (items.length === 0) {
      return { text: "Aucun matériel n'est actuellement en maintenance.", proposals: [] };
    }
    return {
      text:
        "Matériels en maintenance :\n\n" +
        items.map((i) => `- ${i.name}${i.reference ? ` (${i.reference})` : ""}`).join("\n"),
      proposals: [],
    };
  }

  // --- Statistiques : nombre de réservations / chiffre d'affaires
  if (/combien de r[ée]serv|nombre de r[ée]serv|chiffre d'affaires|\bca\b|plus de chiffre|plus rentable/.test(t)) {
    const period =
      resolvePeriodFr(message, timezone, now) ??
      resolvePeriodFr("ce mois", timezone, now)!;
    const stats = await executors.getStats({
      startAt: toLocalDateTimeInput(period.start, timezone),
      endAt: toLocalDateTimeInput(period.end, timezone),
    });
    let text = `Sur la période (${period.label}) : **${stats.bookingsCount} réservation${stats.bookingsCount > 1 ? "s" : ""}** pour un chiffre d'affaires estimé de **${stats.revenue}**.`;
    if (stats.topEquipment.length > 0) {
      text +=
        "\n\nMatériels les plus rentables :\n" +
        stats.topEquipment.map((e, i) => `${i + 1}. ${e.name} — ${e.revenue}`).join("\n");
    }
    return { text, proposals: [] };
  }

  // --- Clients avec réservation en cours
  if (/client/.test(t) && /en cours/.test(t)) {
    const bookings = await executors.listBookings({ filter: "in_progress" });
    if (bookings.length === 0) {
      return { text: "Aucune location n'est en cours actuellement.", proposals: [] };
    }
    const customers = [...new Set(bookings.map((b) => b.customer))];
    return {
      text:
        "Clients avec une location en cours :\n\n" +
        customers.map((c) => `- ${c}`).join("\n"),
      proposals: [],
    };
  }

  // --- Locations sur une période : « locations prévues demain »
  if (/location|r[ée]serv/.test(t)) {
    const period = resolvePeriodFr(message, timezone, now);
    if (period) {
      const bookings = await executors.listBookings({
        filter: "all",
        startAt: toLocalDateTimeInput(period.start, timezone),
        endAt: toLocalDateTimeInput(period.end, timezone),
      });
      if (bookings.length === 0) {
        return { text: `Aucune location prévue ${period.label}.`, proposals: [] };
      }
      return {
        text:
          `Locations ${period.label} :\n\n` +
          bookings
            .map(
              (b) =>
                `- ${b.number} — ${b.customer} : ${b.equipment} (${b.status}, ${b.total})`
            )
            .join("\n"),
        proposals: [],
      };
    }
    const bookings = await executors.listBookings({ filter: "in_progress" });
    if (bookings.length > 0) {
      return {
        text:
          "Locations en cours :\n\n" +
          bookings.map((b) => `- ${b.number} — ${b.customer} : ${b.equipment}`).join("\n"),
        proposals: [],
      };
    }
  }

  return { text: HELP_TEXT, proposals: [] };
}
