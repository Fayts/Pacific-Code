// ============================================================
// Couche Repository — le contrat unique d'accès aux données.
//
//   UI → Services → Repository → Source de données
//
// Aujourd'hui la source est un adapter MOCK (localStorage, données
// fictives). Demain, un adapter Supabase implémentera ces mêmes
// interfaces sans toucher à l'UI ni aux services.
// ============================================================

import type {
  Booking,
  BookingItem,
  BookingStatus,
  BookingStatusHistory,
  Customer,
  DepositStatus,
  EquipmentCategory,
  EquipmentItem,
  EquipmentStatus,
  Organization,
  PaymentStatus,
  PricingMode,
  AvailabilityResult,
  BusinessType,
} from "@/lib/types/database";
import type {
  AgentSettings,
  ChannelConnection,
  ChannelKind,
  ConversationStatus,
  InboxConversation,
  InboxMessage,
  MessageAuthor,
} from "@/lib/types/inbox";

// ------------------------------------------------------------
// Session (authentification simulée en mode mock)
// ------------------------------------------------------------

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type Session = { user: SessionUser } | null;

export type SignUpInput = {
  email: string;
  /** Ignoré en mode mock ; requis par l'authentification réelle. */
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  businessType: BusinessType;
};

// ------------------------------------------------------------
// Entrées normalisées (créations / mises à jour)
// ------------------------------------------------------------

export type EquipmentDraft = {
  name: string;
  categoryId: string | null;
  internalRef: string;
  description: string;
  dailyPrice: number;
  /** "daily" : prix × durée ; "flat" : forfait fixe. */
  pricingMode: PricingMode;
  depositAmount: number;
  quantityTotal: number;
  minRentalDays: number;
  status: EquipmentStatus;
  usageInstructions: string;
  internalNotes: string;
  /** URL de la photo (Storage en réel, data URL en mock) ; undefined = inchangé. */
  photoUrl?: string | null;
};

export type CustomerDraft = {
  type: "individual" | "company";
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  idNumber: string;
  internalNotes: string;
};

/** Réservation normalisée : dates déjà converties en instants UTC (ISO). */
export type BookingDraft = {
  customerId: string;
  items: Array<{ equipmentId: string; quantity: number }>;
  startAtIso: string;
  endAtIso: string;
  durationDays: number;
  discountAmount: number;
  extraFeesAmount: number;
  depositAmount: number;
  notes: string;
  status: Extract<BookingStatus, "draft" | "pending" | "confirmed">;
};

export type BookingWithRelations = Booking & {
  customer: Customer | null;
  items: Array<BookingItem & { equipment: EquipmentItem | null }>;
};

// ------------------------------------------------------------
// Interfaces des repositories
// ------------------------------------------------------------

export interface AuthRepository {
  getSession(): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  signUp(input: SignUpInput): Promise<Session>;
  signOut(): Promise<void>;
  /** Envoie l'email de réinitialisation (mode supabase uniquement). */
  requestPasswordReset?(email: string, redirectTo: string): Promise<void>;
  /** Change le mot de passe de la session active (mode supabase uniquement). */
  updatePassword?(newPassword: string): Promise<void>;
}

export interface OrganizationRepository {
  /** null = aucun utilisateur connecté (ou organisation pas encore créée). */
  get(): Promise<Organization | null>;
  update(patch: Partial<Organization>): Promise<Organization>;
}

export interface CategoryRepository {
  list(): Promise<EquipmentCategory[]>;
  create(name: string, description?: string): Promise<EquipmentCategory>;
  remove(id: string): Promise<void>;
}

export interface EquipmentRepository {
  list(options?: { includeArchived?: boolean }): Promise<EquipmentItem[]>;
  get(id: string): Promise<EquipmentItem | null>;
  create(draft: EquipmentDraft): Promise<EquipmentItem>;
  update(id: string, draft: EquipmentDraft): Promise<EquipmentItem | null>;
  setStatus(id: string, status: EquipmentStatus): Promise<void>;
  archive(id: string): Promise<{ ok: boolean; error?: string }>;
  unarchive(id: string): Promise<void>;
  duplicate(id: string): Promise<EquipmentItem | null>;
}

export interface CustomerRepository {
  list(options?: { includeArchived?: boolean }): Promise<Customer[]>;
  get(id: string): Promise<Customer | null>;
  create(draft: CustomerDraft): Promise<Customer>;
  update(id: string, draft: CustomerDraft): Promise<Customer | null>;
  archive(id: string): Promise<{ ok: boolean; error?: string }>;
  unarchive(id: string): Promise<void>;
}

export interface BookingRepository {
  list(): Promise<BookingWithRelations[]>;
  get(id: string): Promise<BookingWithRelations | null>;
  history(bookingId: string): Promise<BookingStatusHistory[]>;
  /**
   * Quantité disponible d'un matériel sur [startAtIso, endAtIso).
   * Statuts bloquants : pending, confirmed, in_progress.
   */
  checkAvailability(params: {
    equipmentId: string;
    startAtIso: string;
    endAtIso: string;
    quantity: number;
    excludeBookingId?: string | null;
  }): Promise<AvailabilityResult>;
  create(
    draft: BookingDraft,
    pricing: { lineTotals: number[]; subtotal: number; total: number }
  ): Promise<Booking>;
  update(
    id: string,
    draft: BookingDraft,
    pricing: { lineTotals: number[]; subtotal: number; total: number }
  ): Promise<Booking | null>;
  changeStatus(
    id: string,
    to: BookingStatus,
    note?: string
  ): Promise<{ ok: boolean; error?: string }>;
  setPaymentStatus(id: string, status: PaymentStatus): Promise<void>;
  setDepositStatus(id: string, status: DepositStatus): Promise<void>;
  duplicate(id: string): Promise<Booking | null>;
}

// ------------------------------------------------------------
// Agent IA commercial : canaux, boîte de réception, réglages
// ------------------------------------------------------------

export interface ChannelRepository {
  list(): Promise<ChannelConnection[]>;
  /** Connexion simulée en mode mock ; OAuth réel avec le backend. */
  connect(channel: ChannelKind, displayName: string): Promise<ChannelConnection>;
  disconnect(channel: ChannelKind): Promise<void>;
}

export type NewInboxMessage = {
  direction: "inbound" | "outbound";
  author: MessageAuthor;
  body: string;
};

export interface InboxRepository {
  listConversations(): Promise<InboxConversation[]>;
  getConversation(id: string): Promise<InboxConversation | null>;
  listMessages(conversationId: string): Promise<InboxMessage[]>;
  appendMessage(
    conversationId: string,
    message: NewInboxMessage
  ): Promise<InboxMessage | null>;
  setStatus(conversationId: string, status: ConversationStatus): Promise<void>;
  /** Supprime la conversation et tous ses messages (irréversible). */
  deleteConversation(conversationId: string): Promise<void>;
  /** Nouvelle conversation entrante (formulaire public, simulation, webhooks demain). */
  createConversation(input: {
    channel: ChannelKind;
    customerName: string;
    customerContact?: string;
    subject?: string;
    body: string;
  }): Promise<InboxConversation>;
}

export interface AgentSettingsRepository {
  get(): Promise<AgentSettings>;
  update(patch: Partial<AgentSettings>): Promise<AgentSettings>;
}

// ------------------------------------------------------------
// Fournisseur agrégé
// ------------------------------------------------------------

export interface DataProvider {
  /** "mock" aujourd'hui, "supabase" plus tard. */
  readonly kind: "mock" | "supabase";
  auth: AuthRepository;
  organization: OrganizationRepository;
  categories: CategoryRepository;
  equipment: EquipmentRepository;
  customers: CustomerRepository;
  bookings: BookingRepository;
  channels: ChannelRepository;
  inbox: InboxRepository;
  agentSettings: AgentSettingsRepository;
  /** Réabonne l'UI aux changements de données (retourne un désabonnement). */
  subscribe(listener: () => void): () => void;
  /**
   * Jeton d'accès de l'utilisateur (mode supabase uniquement) — permet aux
   * routes API serveur (assistant LLM…) d'agir en son nom sous RLS.
   */
  getAccessToken?(): Promise<string | null>;
  /**
   * Téléverse une photo de matériel (JPEG compressé côté client) et renvoie
   * son URL : Supabase Storage en réel, data URL en mock.
   */
  uploadEquipmentPhoto?(blob: Blob): Promise<string>;
  /** Restaure le jeu de données de démonstration. */
  resetDemoData(): Promise<void>;
}
