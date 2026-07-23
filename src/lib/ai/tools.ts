// Outils de l'assistant IA — la SEULE porte d'accès de l'IA aux données.
// Chaque outil est une fonction validée (zod) et scopée à l'organisation :
// l'IA ne génère jamais de SQL, ne voit jamais d'autres organisations, et
// les outils de préparation ne modifient rien (ils renvoient une proposition
// à confirmer par l'utilisateur).

import { z } from "zod";
import { tool } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { parseLocalDateTimeInput, toLocalDateTimeInput } from "@/lib/core/dates";
import { sanitizeSearchTerm } from "@/lib/core/search";
import {
  computeBookingTotals,
  computeDurationDays,
  requiredMinRentalDays,
} from "@/lib/core/pricing";
import { formatCustomerName, formatMoney } from "@/lib/core/format";
import { derivedBookingStatus, EQUIPMENT_STATUS, BOOKING_STATUS } from "@/lib/core/labels";
import { localDateTimeSchema } from "@/lib/validations/booking";
import type {
  AssistantProposal,
  BookingProposal,
} from "@/lib/ai/proposals";
import type {
  AvailabilityResult,
  EquipmentAvailabilityRow,
} from "@/lib/types/database";

// ============================================================
// Schémas d'entrée des outils
// ============================================================

const searchEquipmentInput = z.object({
  query: z
    .string()
    .describe("Texte à chercher dans le nom ou la référence (vide = tout le parc)")
    .optional(),
  status: z
    .enum(["available", "maintenance", "unavailable", "all"])
    .describe("Filtre sur le statut opérationnel")
    .optional(),
});

const listAvailabilityInput = z.object({
  startAt: localDateTimeSchema.describe(
    "Début de période, format yyyy-MM-ddTHH:mm, heure locale de l'entreprise"
  ),
  endAt: localDateTimeSchema.describe("Fin de période, même format"),
});

const searchCustomersInput = z.object({
  query: z.string().describe("Nom, société, email ou téléphone à chercher"),
});

const listBookingsInput = z.object({
  filter: z
    .enum(["all", "upcoming", "in_progress", "late", "pending", "completed"])
    .describe(
      "all = toutes, upcoming = départs à venir, in_progress = en cours, late = en retard, pending = à confirmer, completed = terminées"
    )
    .default("all"),
  startAt: localDateTimeSchema
    .describe("Optionnel : ne garder que les réservations chevauchant la période")
    .optional(),
  endAt: localDateTimeSchema.optional(),
});

const statsInput = z.object({
  startAt: localDateTimeSchema.describe("Début de période analysée"),
  endAt: localDateTimeSchema.describe("Fin de période analysée"),
});

const proposeBookingInput = z.object({
  customerId: z.string().uuid().describe("Identifiant du client (via search_customers)"),
  items: z
    .array(
      z.object({
        equipmentId: z.string().uuid().describe("Identifiant du matériel"),
        quantity: z.number().int().min(1).default(1),
      })
    )
    .min(1),
  startAt: localDateTimeSchema.describe("Départ, heure locale de l'entreprise"),
  endAt: localDateTimeSchema.describe("Retour, heure locale de l'entreprise"),
  notes: z.string().max(2000).optional(),
});

const proposeCustomerInput = z.object({
  type: z.enum(["individual", "company"]).default("individual"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const proposeEquipmentStatusInput = z.object({
  equipmentId: z.string().uuid(),
  status: z.enum(["available", "maintenance", "unavailable"]),
  note: z.string().max(500).optional(),
});

// ============================================================
// Exécuteurs (partagés entre le mode LLM et le mode démo)
// ============================================================

export type AssistantToolkit = Awaited<ReturnType<typeof createAssistantToolkit>>;

export type AssistantToolkitContext = {
  organizationId: string;
  timezone: string;
  currency: string;
};

/**
 * Le client Supabase injecté doit être AUTHENTIFIÉ au nom de l'utilisateur
 * (jeton Bearer) : la RLS garantit alors l'isolation multi-tenant.
 */
export async function createAssistantToolkit(
  supabase: SupabaseClient<Database>,
  context: AssistantToolkitContext
) {
  const orgId = context.organizationId;
  const timezone = context.timezone;
  const currency = context.currency;

  const executors = {
    async searchEquipment(input: z.infer<typeof searchEquipmentInput>) {
      let query = supabase
        .from("equipment_items")
        .select("id, name, internal_ref, daily_price, pricing_mode, deposit_amount, quantity_total, status, equipment_categories(name)")
        .eq("organization_id", orgId)
        .is("archived_at", null)
        .order("name")
        .limit(25);
      const equipmentTerm = sanitizeSearchTerm(input.query ?? "");
      if (equipmentTerm) {
        query = query.or(
          `name.ilike.%${equipmentTerm}%,internal_ref.ilike.%${equipmentTerm}%`
        );
      }
      if (input.status && input.status !== "all") {
        query = query.eq("status", input.status);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        reference: e.internal_ref,
        category:
          (e.equipment_categories as unknown as { name: string } | null)?.name ??
          null,
        dailyPrice: e.daily_price,
        // « daily » : prix par jour ; « flat » : forfait à prix fixe.
        pricingMode: e.pricing_mode,
        deposit: e.deposit_amount,
        quantity: e.quantity_total,
        status: EQUIPMENT_STATUS[e.status].label,
      }));
    },

    async listAvailability(input: z.infer<typeof listAvailabilityInput>) {
      const start = parseLocalDateTimeInput(input.startAt, timezone);
      const end = parseLocalDateTimeInput(input.endAt, timezone);
      const { data, error } = await supabase.rpc("list_equipment_availability", {
        p_organization_id: orgId,
        p_start_at: start.toISOString(),
        p_end_at: end.toISOString(),
      });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as EquipmentAvailabilityRow[];
      return rows.map((r) => ({
        equipmentId: r.equipment_id,
        name: r.name,
        status: EQUIPMENT_STATUS[r.status].label,
        total: r.quantity_total,
        booked: r.quantity_booked,
        available: r.quantity_available,
      }));
    },

    async searchCustomers(input: z.infer<typeof searchCustomersInput>) {
      // « Jean Dupont » doit trouver prénom=Jean + nom=Dupont : la recherche
      // se fait terme par terme, chaque terme devant correspondre à au moins
      // un champ (les colonnes séparées ne contiennent jamais le nom complet).
      const terms = input.query
        .split(/\s+/)
        .map((t) => sanitizeSearchTerm(t))
        .filter((t) => t.length > 0);
      if (terms.length === 0) return [];

      const columns = ["first_name", "last_name", "company_name", "email", "phone"];
      const orExpression = terms
        .flatMap((t) => columns.map((col) => `${col}.ilike.%${t}%`))
        .join(",");
      const { data, error } = await supabase
        .from("customers")
        .select("id, type, first_name, last_name, company_name, email, phone")
        .eq("organization_id", orgId)
        .is("archived_at", null)
        .or(orExpression)
        .order("last_name")
        .limit(30);
      if (error) throw new Error(error.message);

      const matchesAllTerms = (c: {
        first_name: string;
        last_name: string;
        company_name: string | null;
        email: string | null;
        phone: string | null;
      }) =>
        terms.every((t) =>
          [c.first_name, c.last_name, c.company_name, c.email, c.phone]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(t.toLowerCase()))
        );

      return (data ?? [])
        .filter(matchesAllTerms)
        .slice(0, 15)
        .map((c) => ({
          id: c.id,
          name: formatCustomerName(c),
          type: c.type,
          email: c.email,
          phone: c.phone,
        }));
    },

    async listBookings(input: z.infer<typeof listBookingsInput>) {
      const now = new Date();
      let query = supabase
        .from("bookings")
        .select(
          "id, booking_number, status, start_at, end_at, total_amount, customers(type, first_name, last_name, company_name), booking_items(quantity, equipment_items(name))"
        )
        .eq("organization_id", orgId)
        .order("start_at", { ascending: true })
        .limit(25);

      switch (input.filter) {
        case "upcoming":
          query = query
            .in("status", ["pending", "confirmed"])
            .gte("start_at", now.toISOString());
          break;
        case "in_progress":
          query = query.eq("status", "in_progress");
          break;
        case "late":
          query = query
            .eq("status", "in_progress")
            .lt("end_at", now.toISOString());
          break;
        case "pending":
          query = query.eq("status", "pending");
          break;
        case "completed":
          query = query
            .eq("status", "completed")
            .order("start_at", { ascending: false });
          break;
      }
      if (input.startAt && input.endAt) {
        const start = parseLocalDateTimeInput(input.startAt, timezone);
        const end = parseLocalDateTimeInput(input.endAt, timezone);
        query = query
          .lt("start_at", end.toISOString())
          .gt("end_at", start.toISOString());
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map((b) => ({
        number: b.booking_number,
        status: BOOKING_STATUS[derivedBookingStatus(b.status, b.end_at, now)].label,
        customer: formatCustomerName(
          (b.customers as unknown as {
            type: "individual" | "company";
            first_name: string;
            last_name: string;
            company_name: string | null;
          }) ?? {}
        ),
        startAt: toLocalDateTimeInput(new Date(b.start_at), timezone),
        endAt: toLocalDateTimeInput(new Date(b.end_at), timezone),
        total: formatMoney(b.total_amount, currency),
        equipment: (b.booking_items ?? [])
          .map(
            (i: { quantity: number; equipment_items: unknown }) =>
              `${(i.equipment_items as { name: string } | null)?.name ?? "?"}${
                i.quantity > 1 ? ` ×${i.quantity}` : ""
              }`
          )
          .join(", "),
      }));
    },

    async getStats(input: z.infer<typeof statsInput>) {
      const start = parseLocalDateTimeInput(input.startAt, timezone);
      const end = parseLocalDateTimeInput(input.endAt, timezone);
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, status, total_amount, start_at, booking_items(line_total, equipment_items(name))"
        )
        .eq("organization_id", orgId)
        .gte("start_at", start.toISOString())
        .lt("start_at", end.toISOString())
        .not("status", "in", '("cancelled","draft")');
      if (error) throw new Error(error.message);

      const bookings = data ?? [];
      const revenue = bookings.reduce((sum, b) => sum + (b.total_amount ?? 0), 0);
      const byEquipment = new Map<string, number>();
      for (const b of bookings) {
        for (const item of b.booking_items ?? []) {
          const name =
            (item.equipment_items as unknown as { name: string } | null)?.name ??
            "Inconnu";
          byEquipment.set(name, (byEquipment.get(name) ?? 0) + (item.line_total ?? 0));
        }
      }
      const topEquipment = [...byEquipment.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, revenue: formatMoney(value, currency) }));

      return {
        bookingsCount: bookings.length,
        revenue: formatMoney(revenue, currency),
        topEquipment,
      };
    },

    async proposeBooking(
      input: z.infer<typeof proposeBookingInput>
    ): Promise<BookingProposal | { error: string }> {
      const start = parseLocalDateTimeInput(input.startAt, timezone);
      const end = parseLocalDateTimeInput(input.endAt, timezone);
      if (end <= start) {
        return { error: "La date de retour doit être après le départ" };
      }

      const { data: customer } = await supabase
        .from("customers")
        .select("id, type, first_name, last_name, company_name")
        .eq("organization_id", orgId)
        .eq("id", input.customerId)
        .maybeSingle();
      if (!customer) {
        return { error: "Client introuvable — utilise search_customers d'abord" };
      }

      const equipmentIds = input.items.map((i) => i.equipmentId);
      const { data: equipment } = await supabase
        .from("equipment_items")
        .select("id, name, daily_price, pricing_mode, deposit_amount, min_rental_days")
        .eq("organization_id", orgId)
        .in("id", equipmentIds)
        .is("archived_at", null);
      const byId = new Map((equipment ?? []).map((e) => [e.id, e]));
      for (const item of input.items) {
        if (!byId.get(item.equipmentId)) {
          return { error: "Matériel introuvable — utilise search_equipment d'abord" };
        }
      }

      const durationDays = computeDurationDays(start, end);
      const minDays = requiredMinRentalDays(
        input.items.map((i) => byId.get(i.equipmentId)!.min_rental_days)
      );
      if (durationDays < minDays) {
        return { error: `Durée minimale de location : ${minDays} jour(s)` };
      }

      const warnings: string[] = [];
      for (const item of input.items) {
        const { data } = await supabase.rpc("check_equipment_availability", {
          p_equipment_id: item.equipmentId,
          p_start_at: start.toISOString(),
          p_end_at: end.toISOString(),
          p_quantity: item.quantity,
        });
        const availability = data as unknown as AvailabilityResult | null;
        if (availability && !availability.available) {
          const name = byId.get(item.equipmentId)!.name;
          warnings.push(
            `« ${name} » n'est pas disponible sur cette période (${
              availability.reason === "maintenance"
                ? "en maintenance"
                : availability.reason === "conflict"
                  ? "déjà réservé"
                  : "indisponible"
            })`
          );
        }
      }

      const totals = computeBookingTotals({
        items: input.items.map((i) => ({
          dailyPrice: byId.get(i.equipmentId)!.daily_price,
          pricingMode: byId.get(i.equipmentId)!.pricing_mode,
          quantity: i.quantity,
        })),
        durationDays,
      });
      const deposit = input.items.reduce(
        (sum, i) => sum + byId.get(i.equipmentId)!.deposit_amount * i.quantity,
        0
      );

      return {
        kind: "booking_proposal",
        payload: {
          customerId: input.customerId,
          items: input.items.map((i) => ({
            equipmentId: i.equipmentId,
            quantity: i.quantity,
          })),
          startAt: input.startAt,
          endAt: input.endAt,
          discountAmount: 0,
          extraFeesAmount: 0,
          depositAmount: deposit,
          notes: input.notes ?? "",
          status: "confirmed",
        },
        summary: {
          customerName: formatCustomerName(customer),
          items: input.items.map((i) => ({
            equipmentName: byId.get(i.equipmentId)!.name,
            quantity: i.quantity,
            dailyPrice: byId.get(i.equipmentId)!.daily_price,
            pricingMode: byId.get(i.equipmentId)!.pricing_mode,
          })),
          startAt: input.startAt,
          endAt: input.endAt,
          durationDays,
          total: totals.total,
          deposit,
          currency,
          warnings,
        },
      };
    },

    async proposeCustomer(
      input: z.infer<typeof proposeCustomerInput>
    ): Promise<AssistantProposal | { error: string }> {
      if (input.type === "individual" && !input.lastName) {
        return { error: "Le nom de famille est requis pour un particulier" };
      }
      if (input.type === "company" && !input.companyName) {
        return { error: "Le nom de société est requis pour un professionnel" };
      }
      return {
        kind: "customer_proposal",
        payload: {
          type: input.type,
          firstName: input.firstName ?? "",
          lastName: input.lastName ?? "",
          companyName: input.companyName ?? "",
          email: input.email ?? "",
          phone: input.phone ?? "",
          address: input.address ?? "",
          idNumber: "",
          internalNotes: "",
        },
        summary: {
          displayName:
            input.type === "company"
              ? input.companyName!
              : [input.firstName, input.lastName].filter(Boolean).join(" "),
        },
      };
    },

    async proposeEquipmentStatus(
      input: z.infer<typeof proposeEquipmentStatusInput>
    ): Promise<AssistantProposal | { error: string }> {
      const { data: item } = await supabase
        .from("equipment_items")
        .select("id, name")
        .eq("organization_id", orgId)
        .eq("id", input.equipmentId)
        .maybeSingle();
      if (!item) {
        return { error: "Matériel introuvable — utilise search_equipment d'abord" };
      }
      return {
        kind: "equipment_status_proposal",
        payload: {
          equipmentId: input.equipmentId,
          status: input.status,
          note: input.note ?? "",
        },
        summary: {
          equipmentName: item.name,
          statusLabel: EQUIPMENT_STATUS[input.status].label,
        },
      };
    },
  };

  // Wrappers AI SDK pour le mode LLM.
  const aiTools = {
    search_equipment: tool({
      description:
        "Chercher des matériels du catalogue par nom/référence et statut. Renvoie id, prix journalier, caution, quantité et statut.",
      inputSchema: searchEquipmentInput,
      execute: (input) => executors.searchEquipment(input),
    }),
    list_availability: tool({
      description:
        "Disponibilité de tout le parc sur une période donnée (quantités totales, réservées et disponibles par matériel).",
      inputSchema: listAvailabilityInput,
      execute: (input) => executors.listAvailability(input),
    }),
    search_customers: tool({
      description:
        "Chercher des clients par nom, société, email ou téléphone. Renvoie leur id à utiliser pour préparer une réservation.",
      inputSchema: searchCustomersInput,
      execute: (input) => executors.searchCustomers(input),
    }),
    list_bookings: tool({
      description:
        "Lister les réservations (filtres : à venir, en cours, en retard, à confirmer, terminées) éventuellement sur une période.",
      inputSchema: listBookingsInput,
      execute: (input) => executors.listBookings(input),
    }),
    get_stats: tool({
      description:
        "Statistiques simples sur une période : nombre de réservations, chiffre d'affaires, matériels les plus rentables.",
      inputSchema: statsInput,
      execute: (input) => executors.getStats(input),
    }),
    propose_booking: tool({
      description:
        "Préparer une réservation (SANS la créer). Vérifie la disponibilité et calcule le prix. L'utilisateur devra confirmer dans l'interface. Utilise les id renvoyés par search_customers et search_equipment.",
      inputSchema: proposeBookingInput,
      execute: (input) => executors.proposeBooking(input),
    }),
    propose_customer: tool({
      description:
        "Préparer la création d'un client (SANS le créer). L'utilisateur devra confirmer dans l'interface.",
      inputSchema: proposeCustomerInput,
      execute: (input) => executors.proposeCustomer(input),
    }),
    propose_equipment_status: tool({
      description:
        "Préparer un changement de statut d'un matériel : disponible, maintenance ou indisponible (SANS l'appliquer). L'utilisateur devra confirmer.",
      inputSchema: proposeEquipmentStatusInput,
      execute: (input) => executors.proposeEquipmentStatus(input),
    }),
  };

  return { executors, aiTools };
}

/** Détecte les propositions dans les résultats d'outils d'un run LLM. */
export function extractProposals(toolResults: unknown[]): AssistantProposal[] {
  const proposals: AssistantProposal[] = [];
  for (const result of toolResults) {
    if (
      result &&
      typeof result === "object" &&
      "kind" in result &&
      typeof (result as { kind: unknown }).kind === "string" &&
      ["booking_proposal", "customer_proposal", "equipment_status_proposal"].includes(
        (result as { kind: string }).kind
      )
    ) {
      proposals.push(result as AssistantProposal);
    }
  }
  return proposals;
}
