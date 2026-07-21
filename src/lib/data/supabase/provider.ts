// Adapter SUPABASE : implémente le contrat Repository sur le projet
// Supabase Cloud (auth réelle, données partagées entre appareils, RLS
// multi-tenant). Strictement la même interface que l'adapter mock —
// l'UI et les services ne changent pas.
//
// Les règles métier restent dans les services et les fonctions SQL
// (anti double-réservation par verrous consultatifs, numérotation).

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type {
  AvailabilityResult,
  Booking,
  BookingItem,
  BookingStatus,
  BookingStatusHistory,
  Customer,
  Database,
  DepositStatus,
  EquipmentCategory,
  EquipmentItem,
  EquipmentStatus,
  Json,
  Organization,
  PaymentStatus,
} from "@/lib/types/database";
import type {
  AgentSettings,
  ChannelConnection,
  ChannelKind,
  ConversationStatus,
  InboxConversation,
  InboxMessage,
} from "@/lib/types/inbox";
import type {
  AgentSettingsRepository,
  AuthRepository,
  BookingDraft,
  BookingRepository,
  BookingWithRelations,
  CategoryRepository,
  ChannelRepository,
  CustomerDraft,
  CustomerRepository,
  DataProvider,
  EquipmentDraft,
  EquipmentRepository,
  InboxRepository,
  NewInboxMessage,
  OrganizationRepository,
  Session,
  SignUpInput,
} from "@/lib/data/repositories";
import { canTransition, isBlockingStatus } from "@/lib/core/booking-status";
import { computeBookingTotals } from "@/lib/core/pricing";

const BLOCKING: BookingStatus[] = ["pending", "confirmed", "in_progress"];

// Les tables de l'agent (migration 010) ne sont pas encore dans les types
// générés : accès non typé, résultats castés vers les types de inbox.ts.
type UntypedClient = SupabaseClient<Database> & {
  from(table: string): ReturnType<SupabaseClient["from"]>;
};

/** Préfixe de numérotation dérivé du nom d'entreprise (ex. « PRC »). */
function derivePrefix(name: string): string {
  const letters = name
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return letters.length >= 2 ? letters.slice(0, 3) : "RES";
}

function frenchAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Un compte existe déjà avec cet email — connectez-vous.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirmez votre adresse email puis reconnectez-vous.";
  }
  if (m.includes("password should be")) {
    return "Mot de passe trop court (6 caractères minimum).";
  }
  return message;
}

export class SupabaseDataProvider implements DataProvider {
  readonly kind = "supabase" as const;

  private client: SupabaseClient<Database>;
  private listeners = new Set<() => void>();
  private context: { userId: string; orgId: string } | null = null;

  constructor(client?: SupabaseClient<Database>) {
    this.client =
      client ??
      createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    this.client.auth.onAuthStateChange(() => {
      this.context = null;
      this.notify();
    });
  }

  private get raw(): UntypedClient {
    return this.client as UntypedClient;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async resetDemoData(): Promise<void> {
    throw new Error(
      "La réinitialisation n'existe qu'en mode démonstration — ici, vos données sont réelles."
    );
  }

  /** Utilisateur + organisation courants (null si déconnecté / sans org). */
  private async ensureContext(): Promise<{ userId: string; orgId: string } | null> {
    if (this.context) return this.context;
    const { data } = await this.client.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return null;
    const { data: member } = await this.client
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!member) return null;
    this.context = { userId, orgId: member.organization_id };
    return this.context;
  }

  // ----------------------------------------------------------
  // Auth
  // ----------------------------------------------------------

  auth: AuthRepository = {
    getSession: async (): Promise<Session> => {
      const { data } = await this.client.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      return {
        user: {
          id: user.id,
          email: user.email ?? "",
          firstName: String(meta.first_name ?? ""),
          lastName: String(meta.last_name ?? ""),
        },
      };
    },

    signIn: async (email: string, password: string): Promise<Session> => {
      const { error } = await this.client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw new Error(frenchAuthError(error.message));
      this.context = null;
      return this.auth.getSession();
    },

    signUp: async (input: SignUpInput): Promise<Session> => {
      const { data, error } = await this.client.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          data: {
            first_name: input.firstName,
            last_name: input.lastName,
            company_name: input.companyName,
            business_type: input.businessType,
          },
        },
      });
      if (error) throw new Error(frenchAuthError(error.message));
      if (!data.session) {
        throw new Error(
          "Compte créé — confirmez votre adresse email (lien reçu par email), puis connectez-vous."
        );
      }

      // Crée l'organisation du nouveau compte (fonction SQL dédiée).
      const { error: orgError } = await this.client.rpc(
        "create_organization_with_owner",
        {
          p_name: input.companyName,
          p_business_type: input.businessType,
          p_booking_prefix: derivePrefix(input.companyName),
        }
      );
      if (orgError) {
        throw new Error(
          "Compte créé, mais l'espace entreprise n'a pas pu être initialisé : " +
            orgError.message
        );
      }
      this.context = null;
      this.notify();
      return this.auth.getSession();
    },

    signOut: async (): Promise<void> => {
      await this.client.auth.signOut();
      this.context = null;
    },
  };

  // ----------------------------------------------------------
  // Organisation
  // ----------------------------------------------------------

  organization: OrganizationRepository = {
    get: async (): Promise<Organization | null> => {
      const ctx = await this.ensureContext();
      if (!ctx) return null;
      const { data } = await this.client
        .from("organizations")
        .select("*")
        .eq("id", ctx.orgId)
        .maybeSingle();
      return data ?? null;
    },

    update: async (patch: Partial<Organization>): Promise<Organization> => {
      const ctx = await this.ensureContext();
      if (!ctx) throw new Error("Aucune organisation active");
      const { data, error } = await this.client
        .from("organizations")
        .update(patch)
        .eq("id", ctx.orgId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      this.notify();
      return data;
    },
  };

  // ----------------------------------------------------------
  // Catégories
  // ----------------------------------------------------------

  categories: CategoryRepository = {
    list: async (): Promise<EquipmentCategory[]> => {
      const { data } = await this.client
        .from("equipment_categories")
        .select("*")
        .order("name");
      return data ?? [];
    },

    create: async (name: string, description?: string) => {
      const ctx = await this.ensureContext();
      if (!ctx) throw new Error("Aucune organisation active");
      const { data, error } = await this.client
        .from("equipment_categories")
        .insert({
          organization_id: ctx.orgId,
          name,
          description: description || null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      this.notify();
      return data;
    },

    remove: async (id: string): Promise<void> => {
      await this.client.from("equipment_categories").delete().eq("id", id);
      this.notify();
    },
  };

  // ----------------------------------------------------------
  // Matériel
  // ----------------------------------------------------------

  private equipmentInsertPayload(draft: EquipmentDraft, orgId: string, userId: string) {
    return {
      organization_id: orgId,
      category_id: draft.categoryId,
      name: draft.name,
      internal_ref: draft.internalRef || null,
      description: draft.description || null,
      daily_price: draft.dailyPrice,
      deposit_amount: draft.depositAmount,
      quantity_total: draft.quantityTotal,
      min_rental_days: draft.minRentalDays,
      status: draft.status,
      usage_instructions: draft.usageInstructions || null,
      internal_notes: draft.internalNotes || null,
      created_by: userId,
    };
  }

  equipment: EquipmentRepository = {
    list: async ({ includeArchived = false } = {}) => {
      let query = this.client.from("equipment_items").select("*").order("name");
      if (!includeArchived) query = query.is("archived_at", null);
      const { data } = await query;
      return data ?? [];
    },

    get: async (id: string) => {
      const { data } = await this.client
        .from("equipment_items")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      return data ?? null;
    },

    create: async (draft: EquipmentDraft): Promise<EquipmentItem> => {
      const ctx = await this.ensureContext();
      if (!ctx) throw new Error("Aucune organisation active");
      const { data, error } = await this.client
        .from("equipment_items")
        .insert(this.equipmentInsertPayload(draft, ctx.orgId, ctx.userId))
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      this.notify();
      return data;
    },

    update: async (id: string, draft: EquipmentDraft) => {
      const { data, error } = await this.client
        .from("equipment_items")
        .update({
          category_id: draft.categoryId,
          name: draft.name,
          internal_ref: draft.internalRef || null,
          description: draft.description || null,
          daily_price: draft.dailyPrice,
          deposit_amount: draft.depositAmount,
          quantity_total: draft.quantityTotal,
          min_rental_days: draft.minRentalDays,
          status: draft.status,
          usage_instructions: draft.usageInstructions || null,
          internal_notes: draft.internalNotes || null,
        })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) this.notify();
      return data ?? null;
    },

    setStatus: async (id: string, status: EquipmentStatus): Promise<void> => {
      await this.client
        .from("equipment_items")
        .update({ status })
        .eq("id", id);
      this.notify();
    },

    archive: async (id: string) => {
      const { data: active } = await this.client
        .from("booking_items")
        .select("id, bookings!inner(status)")
        .eq("equipment_id", id)
        .in("bookings.status", BLOCKING)
        .limit(1);
      if (active && active.length > 0) {
        return {
          ok: false,
          error:
            "Impossible d'archiver : des réservations actives utilisent ce matériel",
        };
      }
      await this.client
        .from("equipment_items")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      this.notify();
      return { ok: true };
    },

    unarchive: async (id: string): Promise<void> => {
      await this.client
        .from("equipment_items")
        .update({ archived_at: null })
        .eq("id", id);
      this.notify();
    },

    duplicate: async (id: string) => {
      const source = await this.equipment.get(id);
      if (!source) return null;
      return this.equipment.create({
        name: `${source.name} (copie)`,
        categoryId: source.category_id,
        internalRef: "",
        description: source.description ?? "",
        dailyPrice: source.daily_price,
        depositAmount: source.deposit_amount,
        quantityTotal: source.quantity_total,
        minRentalDays: source.min_rental_days,
        status: "available",
        usageInstructions: source.usage_instructions ?? "",
        internalNotes: source.internal_notes ?? "",
      });
    },
  };

  // ----------------------------------------------------------
  // Clients
  // ----------------------------------------------------------

  customers: CustomerRepository = {
    list: async ({ includeArchived = false } = {}) => {
      let query = this.client.from("customers").select("*");
      if (!includeArchived) query = query.is("archived_at", null);
      const { data } = await query
        .order("last_name")
        .order("company_name");
      return data ?? [];
    },

    get: async (id: string) => {
      const { data } = await this.client
        .from("customers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      return data ?? null;
    },

    create: async (draft: CustomerDraft): Promise<Customer> => {
      const ctx = await this.ensureContext();
      if (!ctx) throw new Error("Aucune organisation active");
      const { data, error } = await this.client
        .from("customers")
        .insert({
          organization_id: ctx.orgId,
          type: draft.type,
          first_name: draft.firstName,
          last_name: draft.lastName,
          company_name: draft.companyName || null,
          email: draft.email || null,
          phone: draft.phone || null,
          address: draft.address || null,
          id_number: draft.idNumber || null,
          internal_notes: draft.internalNotes || null,
          created_by: ctx.userId,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      this.notify();
      return data;
    },

    update: async (id: string, draft: CustomerDraft) => {
      const { data, error } = await this.client
        .from("customers")
        .update({
          type: draft.type,
          first_name: draft.firstName,
          last_name: draft.lastName,
          company_name: draft.companyName || null,
          email: draft.email || null,
          phone: draft.phone || null,
          address: draft.address || null,
          id_number: draft.idNumber || null,
          internal_notes: draft.internalNotes || null,
        })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) this.notify();
      return data ?? null;
    },

    archive: async (id: string) => {
      const { data: active } = await this.client
        .from("bookings")
        .select("id")
        .eq("customer_id", id)
        .in("status", BLOCKING)
        .limit(1);
      if (active && active.length > 0) {
        return {
          ok: false,
          error: "Impossible d'archiver : ce client a des réservations actives",
        };
      }
      await this.client
        .from("customers")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      this.notify();
      return { ok: true };
    },

    unarchive: async (id: string): Promise<void> => {
      await this.client
        .from("customers")
        .update({ archived_at: null })
        .eq("id", id);
      this.notify();
    },
  };

  // ----------------------------------------------------------
  // Réservations
  // ----------------------------------------------------------

  private mapBooking(row: Record<string, unknown>): BookingWithRelations {
    const { customers, booking_items, ...booking } = row as Record<string, unknown> & {
      customers: Customer | null;
      booking_items: Array<BookingItem & { equipment_items: EquipmentItem | null }>;
    };
    return {
      ...(booking as unknown as Booking),
      customer: customers ?? null,
      items: (booking_items ?? []).map((bi) => {
        const { equipment_items, ...item } = bi;
        return { ...(item as BookingItem), equipment: equipment_items ?? null };
      }),
    };
  }

  bookings: BookingRepository = {
    list: async (): Promise<BookingWithRelations[]> => {
      const { data } = await this.client
        .from("bookings")
        .select("*, customers(*), booking_items(*, equipment_items(*))")
        .order("start_at", { ascending: false });
      return (data ?? []).map((row) =>
        this.mapBooking(row as unknown as Record<string, unknown>)
      );
    },

    get: async (id: string) => {
      const { data } = await this.client
        .from("bookings")
        .select("*, customers(*), booking_items(*, equipment_items(*))")
        .eq("id", id)
        .maybeSingle();
      return data
        ? this.mapBooking(data as unknown as Record<string, unknown>)
        : null;
    },

    history: async (bookingId: string): Promise<BookingStatusHistory[]> => {
      const { data } = await this.client
        .from("booking_status_history")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at");
      return data ?? [];
    },

    checkAvailability: async (params): Promise<AvailabilityResult> => {
      const { data, error } = await this.client.rpc(
        "check_equipment_availability",
        {
          p_equipment_id: params.equipmentId,
          p_start_at: params.startAtIso,
          p_end_at: params.endAtIso,
          p_quantity: params.quantity,
          p_exclude_booking_id: params.excludeBookingId ?? undefined,
        }
      );
      if (error) throw new Error(error.message);
      return data as unknown as AvailabilityResult;
    },

    create: async (draft: BookingDraft, pricing): Promise<Booking> => {
      const ctx = await this.ensureContext();
      if (!ctx) throw new Error("Aucune organisation active");
      const items = await this.bookingItemsPayload(draft, pricing.lineTotals);
      const { data: bookingId, error } = await this.client.rpc(
        "create_booking",
        {
          p_organization_id: ctx.orgId,
          p_customer_id: draft.customerId,
          p_start_at: draft.startAtIso,
          p_end_at: draft.endAtIso,
          p_duration_days: draft.durationDays,
          p_items: items as unknown as Json,
          p_subtotal: pricing.subtotal,
          p_discount_amount: draft.discountAmount,
          p_extra_fees_amount: draft.extraFeesAmount,
          p_total_amount: pricing.total,
          p_deposit_amount: draft.depositAmount,
          p_status: draft.status,
          p_notes: draft.notes || undefined,
        }
      );
      if (error) throw new Error(this.frenchBookingError(error.message));
      const { data } = await this.client
        .from("bookings")
        .select("*")
        .eq("id", bookingId as string)
        .single();
      this.notify();
      return data as Booking;
    },

    update: async (id: string, draft: BookingDraft, pricing) => {
      const items = await this.bookingItemsPayload(draft, pricing.lineTotals);
      const { error } = await this.client.rpc("update_booking_details", {
        p_booking_id: id,
        p_customer_id: draft.customerId,
        p_start_at: draft.startAtIso,
        p_end_at: draft.endAtIso,
        p_duration_days: draft.durationDays,
        p_items: items as unknown as Json,
        p_subtotal: pricing.subtotal,
        p_discount_amount: draft.discountAmount,
        p_extra_fees_amount: draft.extraFeesAmount,
        p_total_amount: pricing.total,
        p_deposit_amount: draft.depositAmount,
        p_notes: draft.notes || undefined,
      });
      if (error) {
        if (error.message.includes("booking not found")) return null;
        throw new Error(this.frenchBookingError(error.message));
      }
      const { data } = await this.client
        .from("bookings")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      this.notify();
      return (data as Booking) ?? null;
    },

    changeStatus: async (id: string, to: BookingStatus, note?: string) => {
      const ctx = await this.ensureContext();
      if (!ctx) return { ok: false, error: "Aucune organisation active" };
      const { data: booking } = await this.client
        .from("bookings")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!booking) return { ok: false, error: "Réservation introuvable" };
      const from = booking.status;
      if (from === to) return { ok: true };
      if (!canTransition(from, to)) {
        return {
          ok: false,
          error: `Passage impossible de « ${from} » à « ${to} »`,
        };
      }

      // La réservation devient bloquante : revérifier chaque matériel.
      if (!isBlockingStatus(from) && isBlockingStatus(to)) {
        const { data: items } = await this.client
          .from("booking_items")
          .select("equipment_id, quantity")
          .eq("booking_id", id);
        for (const bi of items ?? []) {
          const availability = await this.bookings.checkAvailability({
            equipmentId: bi.equipment_id,
            startAtIso: booking.start_at,
            endAtIso: booking.end_at,
            quantity: bi.quantity,
            excludeBookingId: id,
          });
          if (!availability.available) {
            const { data: eq } = await this.client
              .from("equipment_items")
              .select("name")
              .eq("id", bi.equipment_id)
              .maybeSingle();
            return {
              ok: false,
              error: `« ${eq?.name ?? "Un matériel"} » n'est plus disponible sur cette période`,
            };
          }
        }
      }

      const nowIso = new Date().toISOString();
      const patch: Partial<Booking> = { status: to };
      if (to === "confirmed") patch.confirmed_at = nowIso;
      if (to === "in_progress") patch.started_at = nowIso;
      if (to === "completed") patch.completed_at = nowIso;
      if (to === "cancelled") patch.cancelled_at = nowIso;

      const { error } = await this.client
        .from("bookings")
        .update(patch)
        .eq("id", id);
      if (error) return { ok: false, error: error.message };

      await this.client.from("booking_status_history").insert({
        organization_id: booking.organization_id,
        booking_id: id,
        from_status: from,
        to_status: to,
        note: note || null,
        changed_by: ctx.userId,
      });
      this.notify();
      return { ok: true };
    },

    setPaymentStatus: async (id: string, status: PaymentStatus) => {
      const { data } = await this.client
        .from("bookings")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (!data) return;
      await this.client.from("bookings").update({ payment_status: status }).eq("id", id);
      this.notify();
    },

    setDepositStatus: async (id: string, status: DepositStatus) => {
      const { data } = await this.client
        .from("bookings")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (!data) return;
      await this.client.from("bookings").update({ deposit_status: status }).eq("id", id);
      this.notify();
    },

    duplicate: async (id: string) => {
      const source = await this.bookings.get(id);
      if (!source || source.items.length === 0) return null;
      // Totaux recalculés aux prix ACTUELS du catalogue (cohérence fiche).
      const totals = computeBookingTotals({
        items: source.items.map((bi) => ({
          dailyPrice: bi.equipment?.daily_price ?? 0,
          quantity: bi.quantity,
        })),
        durationDays: source.duration_days,
        discountAmount: source.discount_amount,
        extraFeesAmount: source.extra_fees_amount,
      });
      return this.bookings.create(
        {
          customerId: source.customer_id,
          items: source.items.map((bi) => ({
            equipmentId: bi.equipment_id,
            quantity: bi.quantity,
          })),
          startAtIso: source.start_at,
          endAtIso: source.end_at,
          durationDays: source.duration_days,
          discountAmount: source.discount_amount,
          extraFeesAmount: source.extra_fees_amount,
          depositAmount: source.deposit_amount,
          notes: source.notes ?? "",
          status: "draft",
        },
        {
          lineTotals: totals.lineTotals,
          subtotal: totals.subtotal,
          total: totals.total,
        }
      );
    },
  };

  /** Lignes d'une réservation avec les prix ACTUELS du catalogue. */
  private async bookingItemsPayload(
    draft: BookingDraft,
    lineTotals: number[]
  ): Promise<Array<Record<string, unknown>>> {
    const ids = draft.items.map((i) => i.equipmentId);
    const { data: equipment } = await this.client
      .from("equipment_items")
      .select("id, daily_price")
      .in("id", ids);
    const priceById = new Map((equipment ?? []).map((e) => [e.id, e.daily_price]));
    return draft.items.map((item, index) => ({
      equipment_id: item.equipmentId,
      quantity: item.quantity,
      daily_price: priceById.get(item.equipmentId) ?? 0,
      line_total: lineTotals[index] ?? 0,
    }));
  }

  private frenchBookingError(message: string): string {
    if (message.includes("EQUIPMENT_UNAVAILABLE")) {
      return "Un matériel n'est plus disponible sur cette période — vérifiez la disponibilité.";
    }
    if (message.includes("customer not found")) {
      return "Client introuvable dans votre organisation.";
    }
    if (message.includes("equipment not found")) {
      return "Matériel introuvable dans votre organisation.";
    }
    return message;
  }

  // ----------------------------------------------------------
  // Agent IA : canaux, boîte de réception, réglages
  // ----------------------------------------------------------

  channels: ChannelRepository = {
    list: async (): Promise<ChannelConnection[]> => {
      const { data } = await this.raw
        .from("channel_connections")
        .select("*");
      return (data ?? []) as ChannelConnection[];
    },

    connect: async (channel: ChannelKind, displayName: string) => {
      const ctx = await this.ensureContext();
      if (!ctx) throw new Error("Aucune organisation active");
      const { data, error } = await this.raw
        .from("channel_connections")
        .upsert(
          {
            organization_id: ctx.orgId,
            channel,
            status: "connected",
            display_name: displayName,
            connected_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,channel" }
        )
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      this.notify();
      return data as ChannelConnection;
    },

    disconnect: async (channel: ChannelKind): Promise<void> => {
      const ctx = await this.ensureContext();
      if (!ctx) return;
      await this.raw
        .from("channel_connections")
        .update({ status: "disconnected", connected_at: null })
        .eq("organization_id", ctx.orgId)
        .eq("channel", channel);
      this.notify();
    },
  };

  inbox: InboxRepository = {
    listConversations: async (): Promise<InboxConversation[]> => {
      const { data } = await this.raw
        .from("inbox_conversations")
        .select("*")
        .order("last_message_at", { ascending: false });
      return (data ?? []) as InboxConversation[];
    },

    getConversation: async (id: string) => {
      const { data } = await this.raw
        .from("inbox_conversations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      return (data as InboxConversation) ?? null;
    },

    listMessages: async (conversationId: string): Promise<InboxMessage[]> => {
      const { data } = await this.raw
        .from("inbox_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at");
      return (data ?? []) as InboxMessage[];
    },

    appendMessage: async (conversationId: string, message: NewInboxMessage) => {
      const conversation = await this.inbox.getConversation(conversationId);
      if (!conversation) return null;
      const nowIso = new Date().toISOString();
      const { data, error } = await this.raw
        .from("inbox_messages")
        .insert({
          organization_id: conversation.organization_id,
          conversation_id: conversationId,
          direction: message.direction,
          author: message.author,
          body: message.body,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await this.raw
        .from("inbox_conversations")
        .update({ last_message_at: nowIso })
        .eq("id", conversationId);
      this.notify();
      return data as InboxMessage;
    },

    setStatus: async (
      conversationId: string,
      status: ConversationStatus
    ): Promise<void> => {
      await this.raw
        .from("inbox_conversations")
        .update({ status })
        .eq("id", conversationId);
      this.notify();
    },

    createConversation: async (input) => {
      const ctx = await this.ensureContext();
      if (!ctx) throw new Error("Aucune organisation active");
      // Rapprochement simple avec le carnet clients (email/téléphone).
      const contact = (input.customerContact ?? "").trim().toLowerCase();
      let customerId: string | null = null;
      if (contact) {
        const customers = await this.customers.list();
        const known = customers.find(
          (c) =>
            (c.email && c.email.toLowerCase() === contact) ||
            (c.phone &&
              c.phone.replace(/\s/g, "") === contact.replace(/\s/g, ""))
        );
        customerId = known?.id ?? null;
      }
      const { data, error } = await this.raw
        .from("inbox_conversations")
        .insert({
          organization_id: ctx.orgId,
          channel: input.channel,
          customer_name: input.customerName,
          customer_contact: input.customerContact ?? null,
          customer_id: customerId,
          subject: input.subject ?? null,
          status: "new",
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await this.raw.from("inbox_messages").insert({
        organization_id: ctx.orgId,
        conversation_id: (data as InboxConversation).id,
        direction: "inbound",
        author: "customer",
        body: input.body,
      });
      this.notify();
      return data as InboxConversation;
    },
  };

  agentSettings: AgentSettingsRepository = {
    get: async (): Promise<AgentSettings> => {
      const ctx = await this.ensureContext();
      if (!ctx) throw new Error("Aucune organisation active");
      const { data } = await this.raw
        .from("agent_settings")
        .select("*")
        .eq("organization_id", ctx.orgId)
        .maybeSingle();
      if (data) return data as AgentSettings;
      // Première visite : crée la ligne avec les défauts de la migration.
      const { data: created, error } = await this.raw
        .from("agent_settings")
        .insert({ organization_id: ctx.orgId })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return created as AgentSettings;
    },

    update: async (patch: Partial<AgentSettings>): Promise<AgentSettings> => {
      const current = await this.agentSettings.get();
      const { data, error } = await this.raw
        .from("agent_settings")
        .update({
          ...patch,
          permissions: patch.permissions
            ? { ...current.permissions, ...patch.permissions }
            : current.permissions,
        })
        .eq("organization_id", current.organization_id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      this.notify();
      return data as AgentSettings;
    },
  };
}
