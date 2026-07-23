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
import { createBrowserClient } from "@supabase/ssr";
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
import { computeBookingTotals } from "@/lib/core/pricing";

const BLOCKING: BookingStatus[] = ["pending", "confirmed", "in_progress"];

// Les tables de l'agent (migration 010) ne sont pas encore dans les types
// générés : accès non typé, résultats castés vers les types de inbox.ts.
type UntypedClient = SupabaseClient<Database> & {
  from(table: string): ReturnType<SupabaseClient["from"]>;
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
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
  if (m.includes("should be different from the old password")) {
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  }
  if (m.includes("rate limit") || m.includes("security purposes")) {
    return "Trop de tentatives — patientez une minute puis réessayez.";
  }
  return message;
}

export class SupabaseDataProvider implements DataProvider {
  readonly kind = "supabase" as const;

  private client: SupabaseClient<Database>;
  private listeners = new Set<() => void>();
  private context: { userId: string; orgId: string } | null = null;

  constructor(client?: SupabaseClient<Database>) {
    // Navigateur : session stockée en COOKIES (@supabase/ssr) pour que le
    // proxy serveur puisse garder les pages. Hors navigateur : client neutre.
    this.client =
      client ??
      (typeof window !== "undefined"
        ? createBrowserClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          )
        : createClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          ));
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

  async getAccessToken(): Promise<string | null> {
    const { data } = await this.client.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async uploadEquipmentPhoto(blob: Blob): Promise<string> {
    const ctx = await this.ensureContext();
    if (!ctx) throw new Error("Aucune organisation active");
    // Chemin préfixé par l'organisation : la politique Storage n'accepte
    // que les membres de l'org (lecture publique, bucket equipment-photos).
    const path = `${ctx.orgId}/${crypto.randomUUID()}.jpg`;
    const { error } = await this.client.storage
      .from("equipment-photos")
      .upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw new Error(error.message);
    const { data } = this.client.storage
      .from("equipment-photos")
      .getPublicUrl(path);
    return data.publicUrl;
  }

  async resetDemoData(): Promise<void> {
    throw new Error(
      "La réinitialisation n'existe qu'en mode démonstration — ici, vos données sont réelles."
    );
  }

  /**
   * Crée l'espace entreprise du compte connecté s'il n'existe pas encore,
   * à partir des métadonnées enregistrées à l'inscription.
   */
  private async ensureOrganizationForUser(): Promise<void> {
    if (await this.ensureContext()) return; // organisation déjà en place
    const { data } = await this.client.auth.getSession();
    const user = data.session?.user;
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const company = String(meta.company_name ?? "").trim();
    if (!company) return; // rien d'automatisable sans nom d'entreprise
    const businessTypes = ["equipment", "vehicles", "nautical", "events", "other"];
    const businessType = businessTypes.includes(String(meta.business_type))
      ? (String(meta.business_type) as Database["public"]["Enums"]["business_type"])
      : "equipment";
    await this.client.rpc("create_organization_with_owner", {
      p_name: company,
      p_business_type: businessType,
      p_booking_prefix: derivePrefix(company),
    });
    this.context = null;
    this.notify();
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
      // Compte confirmé par email APRÈS l'inscription : l'organisation n'a
      // pas pu être créée au signUp (pas de session) — rattrapage ici.
      await this.ensureOrganizationForUser();
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
        // Le serveur exige la confirmation d'email : avec l'auto-confirmation
        // en base (mode pilote), la connexion immédiate aboutit quand même.
        const { error: signInError } = await this.client.auth.signInWithPassword({
          email: input.email.trim(),
          password: input.password,
        });
        if (signInError) {
          throw new Error(
            "Compte créé — confirmez votre adresse email (lien reçu par email), puis connectez-vous."
          );
        }
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

    requestPasswordReset: async (
      email: string,
      redirectTo: string
    ): Promise<void> => {
      const { error } = await this.client.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      );
      if (error) throw new Error(frenchAuthError(error.message));
    },

    updatePassword: async (newPassword: string): Promise<void> => {
      const { error } = await this.client.auth.updateUser({
        password: newPassword,
      });
      if (error) throw new Error(frenchAuthError(error.message));
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
      pricing_mode: draft.pricingMode,
      deposit_amount: draft.depositAmount,
      quantity_total: draft.quantityTotal,
      min_rental_days: draft.minRentalDays,
      status: draft.status,
      usage_instructions: draft.usageInstructions || null,
      internal_notes: draft.internalNotes || null,
      photo_url: draft.photoUrl ?? null,
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
          pricing_mode: draft.pricingMode,
          deposit_amount: draft.depositAmount,
          quantity_total: draft.quantityTotal,
          min_rental_days: draft.minRentalDays,
          status: draft.status,
          usage_instructions: draft.usageInstructions || null,
          internal_notes: draft.internalNotes || null,
          ...(draft.photoUrl !== undefined
            ? { photo_url: draft.photoUrl }
            : {}),
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
        pricingMode: source.pricing_mode,
        depositAmount: source.deposit_amount,
        quantityTotal: source.quantity_total,
        minRentalDays: source.min_rental_days,
        status: "available",
        usageInstructions: source.usage_instructions ?? "",
        internalNotes: source.internal_notes ?? "",
        photoUrl: source.photo_url,
      });
    },

    listAddons: async (equipmentId: string): Promise<EquipmentItem[]> => {
      const { data: links } = await this.client
        .from("equipment_addons")
        .select("addon_id")
        .eq("equipment_id", equipmentId);
      const ids = (links ?? []).map((l) => l.addon_id);
      if (ids.length === 0) return [];
      const { data } = await this.client
        .from("equipment_items")
        .select("*")
        .in("id", ids)
        .is("archived_at", null)
        .order("name");
      return (data ?? []) as EquipmentItem[];
    },

    setAddons: async (equipmentId: string, addonIds: string[]): Promise<void> => {
      const ctx = await this.ensureContext();
      if (!ctx) throw new Error("Aucune organisation active");
      const cleaned = [...new Set(addonIds)].filter((id) => id !== equipmentId);
      // Remplacement complet : suppression puis réinsertion (RLS s'applique).
      const { error: deleteError } = await this.client
        .from("equipment_addons")
        .delete()
        .eq("equipment_id", equipmentId);
      if (deleteError) throw new Error(deleteError.message);
      if (cleaned.length > 0) {
        const { error } = await this.client.from("equipment_addons").insert(
          cleaned.map((addonId) => ({
            organization_id: ctx.orgId,
            equipment_id: equipmentId,
            addon_id: addonId,
          }))
        );
        if (error) throw new Error(error.message);
      }
      this.notify();
    },

    listAddonLinks: async () => {
      const { data } = await this.client
        .from("equipment_addons")
        .select("equipment_id, addon_id");
      return (data ?? []).map((l) => ({
        equipment_id: l.equipment_id,
        addon_id: l.addon_id,
      }));
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
      // Transition atomique côté SQL (verrou de ligne + machine à états +
      // disponibilité revérifiée) : aucune course possible entre deux
      // changements simultanés — le client n'est plus juge de rien.
      const { error } = await this.raw.rpc("change_booking_status", {
        p_booking_id: id,
        p_to: to,
        p_note: note || undefined,
      });
      if (error) {
        const message = error.message ?? "";
        if (message.includes("booking not found")) {
          return { ok: false, error: "Réservation introuvable" };
        }
        if (message.includes("INVALID_TRANSITION")) {
          return {
            ok: false,
            error:
              "Ce changement de statut n'est plus possible — la réservation a évolué entre-temps, rechargez la page.",
          };
        }
        return { ok: false, error: this.frenchBookingError(message) };
      }
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
          pricingMode: bi.equipment?.pricing_mode ?? "daily",
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
      .select("id, daily_price, pricing_mode")
      .in("id", ids);
    const byId = new Map((equipment ?? []).map((e) => [e.id, e]));
    return draft.items.map((item, index) => ({
      equipment_id: item.equipmentId,
      quantity: item.quantity,
      daily_price: byId.get(item.equipmentId)?.daily_price ?? 0,
      pricing_mode: byId.get(item.equipmentId)?.pricing_mode ?? "daily",
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
      if (channel === "messenger") {
        // Retire aussi la page et son jeton (le webhook cesse d'ingérer).
        await this.raw.rpc("delete_messenger_page", {
          p_organization_id: ctx.orgId,
        });
      }
      if (channel === "gmail" || channel === "outlook") {
        // Retire le compte e-mail et ses jetons (la relève cesse).
        await this.raw.rpc("delete_email_account", {
          p_organization_id: ctx.orgId,
          p_provider: channel,
        });
      }
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

    // Messages et fils email suivent par cascade (FK on delete cascade).
    deleteConversation: async (conversationId: string): Promise<void> => {
      const { error } = await this.raw
        .from("inbox_conversations")
        .delete()
        .eq("id", conversationId);
      if (error) throw new Error("Suppression impossible : " + error.message);
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
