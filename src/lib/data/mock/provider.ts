// Adapter MOCK : implémente les repositories sur un document JSON
// persisté dans le navigateur (localStorage). Aucune base de données,
// aucun réseau — toutes les données sont FICTIVES et locales à l'appareil.

import type {
  AvailabilityResult,
  Booking,
  BookingStatus,
  Customer,
  DepositStatus,
  EquipmentCategory,
  EquipmentItem,
  EquipmentStatus,
  Organization,
  PaymentStatus,
} from "@/lib/types/database";
import { periodsOverlap } from "@/lib/core/dates";
import { computeBookingTotals } from "@/lib/core/pricing";
import { canTransition, isBlockingStatus } from "@/lib/core/booking-status";
import { formatCustomerName } from "@/lib/core/format";
import type {
  AgentSettingsRepository,
  AuthRepository,
  BookingRepository,
  ChannelRepository,
  InboxRepository,
  NewInboxMessage,
  BookingWithRelations,
  CategoryRepository,
  CustomerDraft,
  CustomerRepository,
  DataProvider,
  EquipmentDraft,
  EquipmentRepository,
  KnowledgeDraft,
  KnowledgeRepository,
  OrganizationRepository,
  Session,
  SessionUser,
  SignUpInput,
} from "@/lib/data/repositories";
import type {
  AgentSettings,
  ChannelConnection,
  ChannelKind,
  ConversationStatus,
  InboxConversation,
  InboxMessage,
  KnowledgeEntry,
} from "@/lib/types/inbox";
import { buildSeed, MOCK_DB_VERSION, type MockDb } from "@/lib/data/mock/seed";
import {
  createBrowserStorage,
  type KVStorage,
} from "@/lib/data/mock/storage";

const STORAGE_KEY = "pacific-code:mock-db";
const BLOCKING: BookingStatus[] = ["pending", "confirmed", "in_progress"];

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Repli minimaliste (vieux navigateurs) — format UUID v4.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export type MockProviderOptions = {
  storage?: KVStorage;
  now?: () => Date;
  storageKey?: string;
};

export class MockDataProvider implements DataProvider {
  readonly kind = "mock" as const;

  private storage: KVStorage;
  private now: () => Date;
  private storageKey: string;
  private db: MockDb | null = null;
  private listeners = new Set<() => void>();

  constructor(options: MockProviderOptions = {}) {
    this.storage = options.storage ?? createBrowserStorage();
    this.now = options.now ?? (() => new Date());
    this.storageKey = options.storageKey ?? STORAGE_KEY;
  }

  // ----------------------------------------------------------
  // Cycle de vie du document
  // ----------------------------------------------------------

  private load(): MockDb {
    if (this.db) return this.db;
    const raw = this.storage.get(this.storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as MockDb;
        if (parsed.version === MOCK_DB_VERSION) {
          this.db = parsed;
          return parsed;
        }
      } catch {
        // document corrompu → reseed
      }
    }
    const seeded = buildSeed(this.now());
    this.db = seeded;
    this.persist();
    return seeded;
  }

  private persist(): void {
    if (!this.db) return;
    this.storage.set(this.storageKey, JSON.stringify(this.db));
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async uploadEquipmentPhoto(blob: Blob): Promise<string> {
    // Mode mock : la photo (déjà compressée) vit en data URL dans le
    // navigateur, comme le reste des données.
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Photo illisible"));
      reader.readAsDataURL(blob);
    });
  }

  async resetDemoData(): Promise<void> {
    const session = this.db?.session ?? null;
    const users = this.db?.users ?? [];
    this.db = buildSeed(this.now());
    // La session et les comptes créés survivent au reset des données.
    this.db.session = session;
    for (const user of users) {
      if (!this.db.users.some((u) => u.id === user.id)) this.db.users.push(user);
    }
    this.persist();
  }

  private touch<T extends { updated_at: string }>(row: T): T {
    row.updated_at = this.now().toISOString();
    return row;
  }

  // ----------------------------------------------------------
  // Auth (simulée : aucun mot de passe vérifié — mode démo)
  // ----------------------------------------------------------

  auth: AuthRepository = {
    getSession: async (): Promise<Session> => {
      const db = this.load();
      if (!db.session) return null;
      const user = db.users.find((u) => u.id === db.session!.userId);
      return user ? { user } : null;
    },

    signIn: async (email: string): Promise<Session> => {
      const db = this.load();
      const normalized = email.trim().toLowerCase();
      let user = db.users.find((u) => u.email.toLowerCase() === normalized);
      if (!user) {
        user = {
          id: uuid(),
          email: normalized,
          firstName: normalized.split("@")[0] ?? "Utilisateur",
          lastName: "",
        };
        db.users.push(user);
      }
      db.session = { userId: user.id };
      this.persist();
      return { user };
    },

    signUp: async (input: SignUpInput): Promise<Session> => {
      const db = this.load();
      const user: SessionUser = {
        id: uuid(),
        email: input.email.trim().toLowerCase(),
        firstName: input.firstName,
        lastName: input.lastName,
      };
      db.users.push(user);
      db.session = { userId: user.id };
      // L'entreprise de démo prend le nom saisi ; les données fictives
      // restent en place pour que l'application soit vivante dès l'arrivée.
      db.organization.name = input.companyName;
      db.organization.business_type = input.businessType;
      this.touch(db.organization);
      this.persist();
      return { user };
    },

    signOut: async (): Promise<void> => {
      const db = this.load();
      db.session = null;
      this.persist();
    },
  };

  // ----------------------------------------------------------
  // Organisation
  // ----------------------------------------------------------

  organization: OrganizationRepository = {
    get: async (): Promise<Organization> => this.load().organization,

    update: async (patch: Partial<Organization>): Promise<Organization> => {
      const db = this.load();
      Object.assign(db.organization, patch);
      this.touch(db.organization);
      this.persist();
      return db.organization;
    },
  };

  // ----------------------------------------------------------
  // Catégories
  // ----------------------------------------------------------

  categories: CategoryRepository = {
    list: async (): Promise<EquipmentCategory[]> =>
      [...this.load().categories].sort((a, b) => a.name.localeCompare(b.name)),

    create: async (name: string, description?: string) => {
      const db = this.load();
      const nowIso = this.now().toISOString();
      const category: EquipmentCategory = {
        id: uuid(),
        organization_id: db.organization.id,
        name,
        description: description || null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      db.categories.push(category);
      this.persist();
      return category;
    },

    remove: async (id: string): Promise<void> => {
      const db = this.load();
      db.categories = db.categories.filter((c) => c.id !== id);
      for (const item of db.equipment) {
        if (item.category_id === id) item.category_id = null;
      }
      this.persist();
    },
  };

  // ----------------------------------------------------------
  // Matériel
  // ----------------------------------------------------------

  equipment: EquipmentRepository = {
    list: async ({ includeArchived = false } = {}) => {
      const items = this.load().equipment;
      return (includeArchived ? [...items] : items.filter((e) => !e.archived_at)).sort(
        (a, b) => a.name.localeCompare(b.name)
      );
    },

    get: async (id: string) =>
      this.load().equipment.find((e) => e.id === id) ?? null,

    create: async (draft: EquipmentDraft): Promise<EquipmentItem> => {
      const db = this.load();
      const nowIso = this.now().toISOString();
      const item: EquipmentItem = {
        id: uuid(),
        organization_id: db.organization.id,
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
        created_by: db.session?.userId ?? null,
        created_at: nowIso,
        updated_at: nowIso,
        archived_at: null,
      };
      db.equipment.push(item);
      this.persist();
      return item;
    },

    update: async (id: string, draft: EquipmentDraft) => {
      const db = this.load();
      const item = db.equipment.find((e) => e.id === id);
      if (!item) return null;
      item.category_id = draft.categoryId;
      item.name = draft.name;
      item.internal_ref = draft.internalRef || null;
      item.description = draft.description || null;
      item.daily_price = draft.dailyPrice;
      item.pricing_mode = draft.pricingMode;
      item.deposit_amount = draft.depositAmount;
      item.quantity_total = draft.quantityTotal;
      item.min_rental_days = draft.minRentalDays;
      item.status = draft.status;
      item.usage_instructions = draft.usageInstructions || null;
      item.internal_notes = draft.internalNotes || null;
      if (draft.photoUrl !== undefined) item.photo_url = draft.photoUrl;
      this.touch(item);
      this.persist();
      return item;
    },

    setStatus: async (id: string, status: EquipmentStatus): Promise<void> => {
      const db = this.load();
      const item = db.equipment.find((e) => e.id === id);
      if (!item) return;
      item.status = status;
      this.touch(item);
      this.persist();
    },

    archive: async (id: string) => {
      const db = this.load();
      const hasActive = db.bookingItems.some(
        (bi) =>
          bi.equipment_id === id &&
          db.bookings.some(
            (b) => b.id === bi.booking_id && BLOCKING.includes(b.status)
          )
      );
      if (hasActive) {
        return {
          ok: false,
          error:
            "Impossible d'archiver : des réservations actives utilisent ce matériel",
        };
      }
      const item = db.equipment.find((e) => e.id === id);
      if (item) {
        item.archived_at = this.now().toISOString();
        this.touch(item);
        this.persist();
      }
      return { ok: true };
    },

    unarchive: async (id: string): Promise<void> => {
      const db = this.load();
      const item = db.equipment.find((e) => e.id === id);
      if (item) {
        item.archived_at = null;
        this.touch(item);
        this.persist();
      }
    },

    duplicate: async (id: string) => {
      const db = this.load();
      const source = db.equipment.find((e) => e.id === id);
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
      });
    },

    listAddons: async (equipmentId: string): Promise<EquipmentItem[]> => {
      const db = this.load();
      const addonIds = new Set(
        (db.equipmentAddons ?? [])
          .filter((l) => l.equipment_id === equipmentId)
          .map((l) => l.addon_id)
      );
      return db.equipment
        .filter((e) => addonIds.has(e.id) && !e.archived_at)
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    },

    setAddons: async (equipmentId: string, addonIds: string[]): Promise<void> => {
      const db = this.load();
      const cleaned = [...new Set(addonIds)].filter(
        (addonId) =>
          addonId !== equipmentId && db.equipment.some((e) => e.id === addonId)
      );
      db.equipmentAddons = [
        ...(db.equipmentAddons ?? []).filter(
          (l) => l.equipment_id !== equipmentId
        ),
        ...cleaned.map((addonId) => ({
          id: uuid(),
          equipment_id: equipmentId,
          addon_id: addonId,
        })),
      ];
      this.persist();
    },

    listAddonLinks: async () =>
      (this.load().equipmentAddons ?? []).map((l) => ({
        equipment_id: l.equipment_id,
        addon_id: l.addon_id,
      })),
  };

  // ----------------------------------------------------------
  // Clients
  // ----------------------------------------------------------

  customers: CustomerRepository = {
    list: async ({ includeArchived = false } = {}) => {
      const rows = this.load().customers;
      return (includeArchived ? [...rows] : rows.filter((c) => !c.archived_at)).sort(
        (a, b) => formatCustomerName(a).localeCompare(formatCustomerName(b))
      );
    },

    get: async (id: string) =>
      this.load().customers.find((c) => c.id === id) ?? null,

    create: async (draft: CustomerDraft): Promise<Customer> => {
      const db = this.load();
      const nowIso = this.now().toISOString();
      const customer: Customer = {
        id: uuid(),
        organization_id: db.organization.id,
        type: draft.type,
        first_name: draft.firstName,
        last_name: draft.lastName,
        company_name: draft.companyName || null,
        email: draft.email || null,
        phone: draft.phone || null,
        address: draft.address || null,
        id_number: draft.idNumber || null,
        internal_notes: draft.internalNotes || null,
        created_by: db.session?.userId ?? null,
        created_at: nowIso,
        updated_at: nowIso,
        archived_at: null,
      };
      db.customers.push(customer);
      this.persist();
      return customer;
    },

    update: async (id: string, draft: CustomerDraft) => {
      const db = this.load();
      const customer = db.customers.find((c) => c.id === id);
      if (!customer) return null;
      customer.type = draft.type;
      customer.first_name = draft.firstName;
      customer.last_name = draft.lastName;
      customer.company_name = draft.companyName || null;
      customer.email = draft.email || null;
      customer.phone = draft.phone || null;
      customer.address = draft.address || null;
      customer.id_number = draft.idNumber || null;
      customer.internal_notes = draft.internalNotes || null;
      this.touch(customer);
      this.persist();
      return customer;
    },

    archive: async (id: string) => {
      const db = this.load();
      const hasActive = db.bookings.some(
        (b) => b.customer_id === id && BLOCKING.includes(b.status)
      );
      if (hasActive) {
        return {
          ok: false,
          error: "Impossible d'archiver : ce client a des réservations actives",
        };
      }
      const customer = db.customers.find((c) => c.id === id);
      if (customer) {
        customer.archived_at = this.now().toISOString();
        this.touch(customer);
        this.persist();
      }
      return { ok: true };
    },

    unarchive: async (id: string): Promise<void> => {
      const db = this.load();
      const customer = db.customers.find((c) => c.id === id);
      if (customer) {
        customer.archived_at = null;
        this.touch(customer);
        this.persist();
      }
    },
  };

  // ----------------------------------------------------------
  // Agent IA commercial : canaux, boîte de réception, réglages
  // ----------------------------------------------------------

  channels: ChannelRepository = {
    list: async (): Promise<ChannelConnection[]> => [...this.load().channels],

    connect: async (channel: ChannelKind, displayName: string) => {
      const db = this.load();
      const nowIso = this.now().toISOString();
      let row = db.channels.find((c) => c.channel === channel);
      if (!row) {
        row = {
          id: uuid(),
          organization_id: db.organization.id,
          channel,
          status: "connected",
          display_name: displayName,
          connected_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
        };
        db.channels.push(row);
      } else {
        row.status = "connected";
        row.display_name = displayName;
        row.connected_at = nowIso;
        this.touch(row);
      }
      this.persist();
      return row;
    },

    disconnect: async (channel: ChannelKind): Promise<void> => {
      const db = this.load();
      const row = db.channels.find((c) => c.channel === channel);
      if (!row) return;
      row.status = "disconnected";
      row.connected_at = null;
      this.touch(row);
      this.persist();
    },
  };

  inbox: InboxRepository = {
    listConversations: async (): Promise<InboxConversation[]> =>
      [...this.load().conversations].sort((a, b) =>
        b.last_message_at.localeCompare(a.last_message_at)
      ),

    getConversation: async (id: string) =>
      this.load().conversations.find((c) => c.id === id) ?? null,

    listMessages: async (conversationId: string): Promise<InboxMessage[]> =>
      this.load()
        .inboxMessages.filter((m) => m.conversation_id === conversationId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),

    appendMessage: async (conversationId: string, message: NewInboxMessage) => {
      const db = this.load();
      const conversation = db.conversations.find((c) => c.id === conversationId);
      if (!conversation) return null;
      const nowIso = this.now().toISOString();
      const row: InboxMessage = {
        id: uuid(),
        organization_id: db.organization.id,
        conversation_id: conversationId,
        direction: message.direction,
        author: message.author,
        body: message.body,
        created_at: nowIso,
      };
      db.inboxMessages.push(row);
      conversation.last_message_at = nowIso;
      this.touch(conversation);
      this.persist();
      return row;
    },

    setStatus: async (
      conversationId: string,
      status: ConversationStatus
    ): Promise<void> => {
      const db = this.load();
      const conversation = db.conversations.find((c) => c.id === conversationId);
      if (!conversation) return;
      conversation.status = status;
      this.touch(conversation);
      this.persist();
    },

    deleteConversation: async (conversationId: string): Promise<void> => {
      const db = this.load();
      db.conversations = db.conversations.filter((c) => c.id !== conversationId);
      db.inboxMessages = db.inboxMessages.filter(
        (m) => m.conversation_id !== conversationId
      );
      this.persist();
    },

    createConversation: async (input) => {
      const db = this.load();
      const nowIso = this.now().toISOString();
      // Rapprochement simple avec le carnet clients par email/téléphone.
      const contact = (input.customerContact ?? "").trim().toLowerCase();
      const known = contact
        ? db.customers.find(
            (c) =>
              !c.archived_at &&
              ((c.email && c.email.toLowerCase() === contact) ||
                (c.phone && c.phone.replace(/\s/g, "") === contact.replace(/\s/g, "")))
          )
        : undefined;
      const conversation: InboxConversation = {
        id: uuid(),
        organization_id: db.organization.id,
        channel: input.channel,
        customer_name: input.customerName,
        customer_contact: input.customerContact ?? null,
        customer_id: known?.id ?? null,
        subject: input.subject ?? null,
        status: "new",
        last_message_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };
      db.conversations.push(conversation);
      db.inboxMessages.push({
        id: uuid(),
        organization_id: db.organization.id,
        conversation_id: conversation.id,
        direction: "inbound",
        author: "customer",
        body: input.body,
        created_at: nowIso,
      });
      this.persist();
      return conversation;
    },
  };

  agentSettings: AgentSettingsRepository = {
    get: async (): Promise<AgentSettings> => this.load().agentSettings,

    update: async (patch: Partial<AgentSettings>): Promise<AgentSettings> => {
      const db = this.load();
      db.agentSettings = {
        ...db.agentSettings,
        ...patch,
        permissions: {
          ...db.agentSettings.permissions,
          ...(patch.permissions ?? {}),
        },
        organization_id: db.organization.id,
        updated_at: this.now().toISOString(),
      };
      this.persist();
      return db.agentSettings;
    },
  };

  // ----------------------------------------------------------
  // Base de connaissances de l'agent
  // ----------------------------------------------------------

  knowledge: KnowledgeRepository = {
    list: async (): Promise<KnowledgeEntry[]> =>
      [...(this.load().knowledgeEntries ?? [])].sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          b.priority - a.priority ||
          a.question.localeCompare(b.question)
      ),

    create: async (draft: KnowledgeDraft): Promise<KnowledgeEntry> => {
      const db = this.load();
      const nowIso = this.now().toISOString();
      const entry: KnowledgeEntry = {
        id: uuid(),
        organization_id: db.organization.id,
        question: draft.question,
        answer: draft.answer,
        keywords: draft.keywords,
        category: draft.category,
        is_active: draft.isActive,
        priority: draft.priority,
        created_at: nowIso,
        updated_at: nowIso,
      };
      db.knowledgeEntries = [...(db.knowledgeEntries ?? []), entry];
      this.persist();
      return entry;
    },

    update: async (
      id: string,
      patch: Partial<KnowledgeDraft>
    ): Promise<KnowledgeEntry> => {
      const db = this.load();
      const entry = (db.knowledgeEntries ?? []).find((e) => e.id === id);
      if (!entry) throw new Error("Entrée introuvable");
      if (patch.question !== undefined) entry.question = patch.question;
      if (patch.answer !== undefined) entry.answer = patch.answer;
      if (patch.keywords !== undefined) entry.keywords = patch.keywords;
      if (patch.category !== undefined) entry.category = patch.category;
      if (patch.isActive !== undefined) entry.is_active = patch.isActive;
      if (patch.priority !== undefined) entry.priority = patch.priority;
      entry.updated_at = this.now().toISOString();
      this.persist();
      return entry;
    },

    remove: async (id: string): Promise<void> => {
      const db = this.load();
      db.knowledgeEntries = (db.knowledgeEntries ?? []).filter(
        (e) => e.id !== id
      );
      this.persist();
    },
  };

  // ----------------------------------------------------------
  // Réservations
  // ----------------------------------------------------------

  private withRelations(booking: Booking): BookingWithRelations {
    const db = this.load();
    return {
      ...booking,
      customer: db.customers.find((c) => c.id === booking.customer_id) ?? null,
      items: db.bookingItems
        .filter((bi) => bi.booking_id === booking.id)
        .map((bi) => ({
          ...bi,
          equipment: db.equipment.find((e) => e.id === bi.equipment_id) ?? null,
        })),
    };
  }

  private nextBookingNumber(): string {
    const db = this.load();
    const year = this.now().getFullYear();
    let counter = db.counters.find((c) => c.year === year);
    if (!counter) {
      counter = { year, seq: 0 };
      db.counters.push(counter);
    }
    counter.seq += 1;
    return `${db.organization.booking_prefix}-${year}-${String(counter.seq).padStart(4, "0")}`;
  }

  private appendHistory(
    bookingId: string,
    from: BookingStatus | null,
    to: BookingStatus,
    note?: string
  ): void {
    const db = this.load();
    db.history.push({
      id: uuid(),
      organization_id: db.organization.id,
      booking_id: bookingId,
      from_status: from,
      to_status: to,
      note: note || null,
      changed_by: db.session?.userId ?? null,
      created_at: this.now().toISOString(),
    });
  }

  bookings: BookingRepository = {
    list: async (): Promise<BookingWithRelations[]> =>
      [...this.load().bookings]
        .sort((a, b) => b.start_at.localeCompare(a.start_at))
        .map((b) => this.withRelations(b)),

    get: async (id: string) => {
      const booking = this.load().bookings.find((b) => b.id === id);
      return booking ? this.withRelations(booking) : null;
    },

    history: async (bookingId: string) =>
      this.load()
        .history.filter((h) => h.booking_id === bookingId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),

    checkAvailability: async ({
      equipmentId,
      startAtIso,
      endAtIso,
      quantity,
      excludeBookingId,
    }): Promise<AvailabilityResult> => {
      const db = this.load();
      const start = new Date(startAtIso);
      const end = new Date(endAtIso);

      if (!(start < end)) {
        return {
          available: false,
          reason: "invalid_period",
          available_quantity: 0,
          total_quantity: 0,
          conflicts: [],
        };
      }

      const item = db.equipment.find((e) => e.id === equipmentId);
      if (!item) {
        return {
          available: false,
          reason: "not_found",
          available_quantity: 0,
          total_quantity: 0,
          conflicts: [],
        };
      }
      if (item.archived_at || item.status === "unavailable") {
        return {
          available: false,
          reason: "unavailable",
          available_quantity: 0,
          total_quantity: item.quantity_total,
          conflicts: [],
        };
      }
      if (item.status === "maintenance") {
        return {
          available: false,
          reason: "maintenance",
          available_quantity: 0,
          total_quantity: item.quantity_total,
          conflicts: [],
        };
      }

      const overlapping = db.bookingItems
        .map((bi) => ({
          bi,
          booking: db.bookings.find((b) => b.id === bi.booking_id),
        }))
        .filter(
          (x): x is { bi: (typeof db.bookingItems)[number]; booking: Booking } =>
            !!x.booking &&
            x.bi.equipment_id === equipmentId &&
            BLOCKING.includes(x.booking.status) &&
            x.booking.id !== (excludeBookingId ?? "") &&
            periodsOverlap(
              new Date(x.booking.start_at),
              new Date(x.booking.end_at),
              start,
              end
            )
        );

      const booked = overlapping.reduce((sum, x) => sum + x.bi.quantity, 0);
      const availableQty = item.quantity_total - booked;

      return {
        available: availableQty >= quantity,
        reason: availableQty >= quantity ? null : "conflict",
        available_quantity: Math.max(0, availableQty),
        total_quantity: item.quantity_total,
        conflicts: overlapping
          .sort((a, b) => a.booking.start_at.localeCompare(b.booking.start_at))
          .map((x) => ({
            booking_id: x.booking.id,
            booking_number: x.booking.booking_number,
            status: x.booking.status,
            start_at: x.booking.start_at,
            end_at: x.booking.end_at,
            quantity: x.bi.quantity,
            customer_name: formatCustomerName(
              db.customers.find((c) => c.id === x.booking.customer_id) ?? {}
            ),
          })),
      };
    },

    create: async (draft, pricing): Promise<Booking> => {
      const db = this.load();
      const nowIso = this.now().toISOString();
      const booking: Booking = {
        id: uuid(),
        organization_id: db.organization.id,
        booking_number: this.nextBookingNumber(),
        customer_id: draft.customerId,
        status: draft.status,
        start_at: draft.startAtIso,
        end_at: draft.endAtIso,
        duration_days: draft.durationDays,
        subtotal: pricing.subtotal,
        discount_amount: draft.discountAmount,
        extra_fees_amount: draft.extraFeesAmount,
        total_amount: pricing.total,
        deposit_amount: draft.depositAmount,
        payment_status: "unpaid",
        deposit_status: draft.depositAmount > 0 ? "pending" : "not_required",
        notes: draft.notes || null,
        created_by: db.session?.userId ?? null,
        confirmed_at: draft.status === "confirmed" ? nowIso : null,
        started_at: null,
        completed_at: null,
        cancelled_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      db.bookings.push(booking);
      draft.items.forEach((it, index) => {
        const equipment = db.equipment.find((e) => e.id === it.equipmentId);
        db.bookingItems.push({
          id: uuid(),
          organization_id: db.organization.id,
          booking_id: booking.id,
          equipment_id: it.equipmentId,
          quantity: it.quantity,
          daily_price: equipment?.daily_price ?? 0,
          pricing_mode: equipment?.pricing_mode ?? "daily",
          line_total: pricing.lineTotals[index] ?? 0,
          created_at: nowIso,
        });
      });
      this.appendHistory(booking.id, null, draft.status);
      this.persist();
      return booking;
    },

    update: async (id, draft, pricing) => {
      const db = this.load();
      const booking = db.bookings.find((b) => b.id === id);
      if (!booking) return null;
      booking.customer_id = draft.customerId;
      booking.start_at = draft.startAtIso;
      booking.end_at = draft.endAtIso;
      booking.duration_days = draft.durationDays;
      booking.subtotal = pricing.subtotal;
      booking.discount_amount = draft.discountAmount;
      booking.extra_fees_amount = draft.extraFeesAmount;
      booking.total_amount = pricing.total;
      booking.deposit_amount = draft.depositAmount;
      booking.notes = draft.notes || null;
      this.touch(booking);
      const nowIso = this.now().toISOString();
      db.bookingItems = db.bookingItems.filter((bi) => bi.booking_id !== id);
      draft.items.forEach((it, index) => {
        const equipment = db.equipment.find((e) => e.id === it.equipmentId);
        db.bookingItems.push({
          id: uuid(),
          organization_id: db.organization.id,
          booking_id: id,
          equipment_id: it.equipmentId,
          quantity: it.quantity,
          daily_price: equipment?.daily_price ?? 0,
          pricing_mode: equipment?.pricing_mode ?? "daily",
          line_total: pricing.lineTotals[index] ?? 0,
          created_at: nowIso,
        });
      });
      this.persist();
      return booking;
    },

    changeStatus: async (id, to, note) => {
      const db = this.load();
      const booking = db.bookings.find((b) => b.id === id);
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
        const items = db.bookingItems.filter((bi) => bi.booking_id === id);
        for (const bi of items) {
          const availability = await this.bookings.checkAvailability({
            equipmentId: bi.equipment_id,
            startAtIso: booking.start_at,
            endAtIso: booking.end_at,
            quantity: bi.quantity,
            excludeBookingId: id,
          });
          if (!availability.available) {
            const name =
              db.equipment.find((e) => e.id === bi.equipment_id)?.name ??
              "Un matériel";
            return {
              ok: false,
              error: `« ${name} » n'est plus disponible sur cette période`,
            };
          }
        }
      }

      const nowIso = this.now().toISOString();
      booking.status = to;
      if (to === "confirmed") booking.confirmed_at = nowIso;
      if (to === "in_progress") booking.started_at = nowIso;
      if (to === "completed") booking.completed_at = nowIso;
      if (to === "cancelled") booking.cancelled_at = nowIso;
      this.touch(booking);
      this.appendHistory(id, from, to, note);
      this.persist();
      return { ok: true };
    },

    setPaymentStatus: async (id: string, status: PaymentStatus) => {
      const db = this.load();
      const booking = db.bookings.find((b) => b.id === id);
      if (!booking) return;
      booking.payment_status = status;
      this.touch(booking);
      this.persist();
    },

    setDepositStatus: async (id: string, status: DepositStatus) => {
      const db = this.load();
      const booking = db.bookings.find((b) => b.id === id);
      if (!booking) return;
      booking.deposit_status = status;
      this.touch(booking);
      this.persist();
    },

    duplicate: async (id: string) => {
      const db = this.load();
      const source = db.bookings.find((b) => b.id === id);
      if (!source) return null;
      const items = db.bookingItems.filter((bi) => bi.booking_id === id);
      if (items.length === 0) return null;
      // create() relit les prix journaliers du catalogue actuel : on
      // recalcule donc les totaux au lieu de copier ceux de la source,
      // sinon la fiche dupliquée affiche prix × qté × jours ≠ total ligne
      // dès que le tarif a changé entre-temps.
      const totals = computeBookingTotals({
        items: items.map((bi) => ({
          dailyPrice:
            db.equipment.find((e) => e.id === bi.equipment_id)?.daily_price ??
            0,
          pricingMode:
            db.equipment.find((e) => e.id === bi.equipment_id)?.pricing_mode ??
            "daily",
          quantity: bi.quantity,
        })),
        durationDays: source.duration_days,
        discountAmount: source.discount_amount,
        extraFeesAmount: source.extra_fees_amount,
      });
      return this.bookings.create(
        {
          customerId: source.customer_id,
          items: items.map((bi) => ({
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
}
