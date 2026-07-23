// ============================================================
// DONNÉES DE DÉMONSTRATION (FICTIVES) — « Pacific Rent&Clean »
// ============================================================
// Jeu de données du mode mock : une entreprise, 3 catégories,
// 4 matériels, 3 clients et 5 réservations couvrant tous les cas
// (terminée, en cours, EN RETARD, confirmée à venir, à confirmer).
// Les dates sont relatives au moment du seed pour rester réalistes.

import type {
  Booking,
  BookingItem,
  BookingStatusHistory,
  Customer,
  EquipmentCategory,
  EquipmentItem,
  Organization,
} from "@/lib/types/database";
import type {
  AgentSettings,
  ChannelConnection,
  InboxConversation,
  InboxMessage,
  KnowledgeEntry,
} from "@/lib/types/inbox";
import type { SessionUser } from "@/lib/data/repositories";

// v5 : base de connaissances de l'agent (knowledgeEntries).
// v4 : réglages de notification (notify_new_messages, notify_email).
// Un document localStorage d'une version antérieure est re-seedé.
export const MOCK_DB_VERSION = 5;

// IDs stables (format UUID pour rester compatibles avec les validations zod).
export const ORG_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_USER_ID = "22222222-2222-4222-8222-222222222222";
const CAT_INJECTEUR = "31111111-1111-4111-8111-111111111111";
const CAT_PACK = "32222222-2222-4222-8222-222222222222";
const CAT_HP = "33333333-3333-4333-8333-333333333333";
const CAT_PRESTA = "34444444-4444-4444-8444-444444444444";
export const EQ_PUZZI10 = "41111111-1111-4111-8111-111111111111";
export const EQ_PUZZI8 = "42222222-2222-4222-8222-222222222222";
export const EQ_PACK = "43333333-3333-4333-8333-333333333333";
export const EQ_K5 = "44444444-4444-4444-8444-444444444444";
export const EQ_PRESTA_MATELAS = "45555555-5555-4555-8555-555555555555";
export const CUST_JEAN = "51111111-1111-4111-8111-111111111111";
export const CUST_MOANA = "52222222-2222-4222-8222-222222222222";
export const CUST_HOTEL = "53333333-3333-4333-8333-333333333333";
const B1 = "61111111-1111-4111-8111-111111111111";
const B2 = "62222222-2222-4222-8222-222222222222";
const B3 = "63333333-3333-4333-8333-333333333333";
const B4 = "64444444-4444-4444-8444-444444444444";
export const B5_LATE = "65555555-5555-4555-8555-555555555555";
const CH_MESSENGER = "91111111-1111-4111-8111-111111111111";
const CH_GMAIL = "92222222-2222-4222-8222-222222222222";
const CH_WHATSAPP = "93333333-3333-4333-8333-333333333333";
export const CONV_PUZZI = "a1111111-1111-4111-8111-111111111111";
export const CONV_JEAN = "a2222222-2222-4222-8222-222222222222";
export const CONV_K5 = "a3333333-3333-4333-8333-333333333333";
export const CONV_FORM = "a4444444-4444-4444-8444-444444444444";
export const CONV_COMPLAINT = "a5555555-5555-4555-8555-555555555555";
const KB_PAIEMENT = "b1111111-1111-4111-8111-111111111111";
const KB_CAUTION = "b2222222-2222-4222-8222-222222222222";
const KB_LIVRAISON = "b3333333-3333-4333-8333-333333333333";
const KB_HORAIRES = "b4444444-4444-4444-8444-444444444444";
const KB_RETARD = "b5555555-5555-4555-8555-555555555555";
const KB_NETTOYAGE = "b6666666-6666-4666-8666-666666666666";

export type MockDb = {
  version: number;
  seededAt: string;
  session: { userId: string } | null;
  users: SessionUser[];
  organization: Organization;
  categories: EquipmentCategory[];
  equipment: EquipmentItem[];
  customers: Customer[];
  bookings: Booking[];
  bookingItems: BookingItem[];
  history: BookingStatusHistory[];
  counters: Array<{ year: number; seq: number }>;
  channels: ChannelConnection[];
  conversations: InboxConversation[];
  inboxMessages: InboxMessage[];
  agentSettings: AgentSettings;
  knowledgeEntries: KnowledgeEntry[];
};

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

export function buildSeed(now: Date = new Date()): MockDb {
  const iso = (ms: number) => new Date(ms).toISOString();
  const t = now.getTime();
  const created = iso(t - 30 * DAY);
  const year = now.getFullYear();

  const organization: Organization = {
    id: ORG_ID,
    name: "Pacific Rent&Clean",
    business_type: "equipment",
    logo_url: null,
    currency: "XPF",
    timezone: "Pacific/Tahiti",
    locale: "fr",
    date_format: "dd/MM/yyyy",
    booking_prefix: "PRC",
    phone: "+689 87 12 34 56",
    email: "contact@pacific-rentclean.pf",
    address: "Papeete, Tahiti — Polynésie française",
    onboarding_completed_at: created,
    created_by: DEMO_USER_ID,
    created_at: created,
    updated_at: created,
  };

  const categories: EquipmentCategory[] = [
    {
      id: CAT_INJECTEUR,
      organization_id: ORG_ID,
      name: "Injecteur-extracteur",
      description:
        "Nettoyage en profondeur des textiles : canapés, sièges auto, moquettes",
      created_at: created,
      updated_at: created,
    },
    {
      id: CAT_PACK,
      organization_id: ORG_ID,
      name: "Pack nettoyage",
      description: "Ensembles matériel + accessoires prêts à l'emploi",
      created_at: created,
      updated_at: created,
    },
    {
      id: CAT_HP,
      organization_id: ORG_ID,
      name: "Nettoyeur haute pression",
      description: "Terrasses, façades, véhicules",
      created_at: created,
      updated_at: created,
    },
    {
      id: CAT_PRESTA,
      organization_id: ORG_ID,
      name: "Prestations de nettoyage",
      description: "Nettoyage effectué par nos soins, au forfait",
      created_at: created,
      updated_at: created,
    },
  ];

  const equipmentDefaults = {
    organization_id: ORG_ID,
    pricing_mode: "daily" as const,
    created_by: DEMO_USER_ID,
    created_at: created,
    updated_at: created,
    archived_at: null,
  };

  const equipment: EquipmentItem[] = [
    {
      ...equipmentDefaults,
      id: EQ_PUZZI10,
      category_id: CAT_INJECTEUR,
      name: "Kärcher Puzzi 10/1",
      internal_ref: "PZ10-01",
      description:
        "Injecteur-extracteur professionnel. Idéal canapés, matelas, moquettes et sièges de voiture. Livré avec suceur main et suceur sol.",
      daily_price: 7990,
      deposit_amount: 50000,
      quantity_total: 2,
      min_rental_days: 1,
      status: "available",
      usage_instructions:
        "Remplir le réservoir d'eau propre avec le détergent fourni (1 dose pour 4 L). Vider et rincer le bac de récupération après usage.",
      internal_notes: "Données fictives — 2 exemplaires en stock.",
    },
    {
      ...equipmentDefaults,
      id: EQ_PUZZI8,
      category_id: CAT_INJECTEUR,
      name: "Kärcher Puzzi 8/1",
      internal_ref: "PZ8-01",
      description:
        "Injecteur-extracteur compact, parfait pour l'intérieur des véhicules et les petites surfaces textiles.",
      daily_price: 6990,
      deposit_amount: 40000,
      quantity_total: 1,
      min_rental_days: 1,
      status: "available",
      usage_instructions:
        "Utiliser uniquement le détergent RM 760 fourni. Ne pas aspirer de liquides autres que l'eau de nettoyage.",
      internal_notes: "Données fictives.",
    },
    {
      ...equipmentDefaults,
      id: EQ_PACK,
      category_id: CAT_PACK,
      name: "Pack Auto-Home",
      internal_ref: "PACK-AH",
      description:
        "Pack complet : injecteur-extracteur + aspirateur eau et poussière + accessoires (brosses, suceurs, rallonge, détergents). Pour nettoyer voiture et maison le même week-end.",
      daily_price: 9990,
      deposit_amount: 60000,
      quantity_total: 1,
      min_rental_days: 1,
      status: "available",
      usage_instructions:
        "Vérifier le contenu du pack à la remise et au retour (liste fournie dans la mallette).",
      internal_notes: "Données fictives — pack le plus demandé.",
    },
    {
      ...equipmentDefaults,
      id: EQ_K5,
      category_id: CAT_HP,
      name: "Kärcher K5 Premium",
      internal_ref: "K5-01",
      description:
        "Nettoyeur haute pression 145 bars avec nettoyeur de terrasse T-Racer.",
      daily_price: 5990,
      deposit_amount: 30000,
      quantity_total: 1,
      min_rental_days: 1,
      status: "maintenance",
      usage_instructions:
        "Purger l'eau après chaque utilisation. Ne jamais utiliser d'eau de mer.",
      internal_notes: "Données fictives — joint haute pression à remplacer.",
    },
    {
      ...equipmentDefaults,
      id: EQ_PRESTA_MATELAS,
      category_id: CAT_PRESTA,
      name: "Nettoyage matelas (prestation)",
      internal_ref: "PR-MAT",
      description:
        "Nettoyage en profondeur d'un matelas par nos soins : injection-extraction, détachage et désodorisation. Prix au forfait, par matelas.",
      daily_price: 5000,
      pricing_mode: "flat",
      deposit_amount: 0,
      quantity_total: 10,
      min_rental_days: 1,
      status: "available",
      usage_instructions: "",
      internal_notes: "Données fictives — forfait, ne dépend pas de la durée.",
    },
  ];

  const customerDefaults = {
    organization_id: ORG_ID,
    created_by: DEMO_USER_ID,
    created_at: created,
    updated_at: created,
    archived_at: null,
    id_number: null,
  };

  const customers: Customer[] = [
    {
      ...customerDefaults,
      id: CUST_JEAN,
      type: "individual",
      first_name: "Jean",
      last_name: "Dupont",
      company_name: null,
      email: "jean.dupont@mail.pf",
      phone: "+689 87 11 22 33",
      address: "Punaauia, Tahiti",
      internal_notes: "Client régulier — données fictives.",
    },
    {
      ...customerDefaults,
      id: CUST_MOANA,
      type: "individual",
      first_name: "Moana",
      last_name: "Tehani",
      company_name: null,
      email: "moana.tehani@mail.pf",
      phone: "+689 87 44 55 66",
      address: "Faaa, Tahiti",
      internal_notes: "Données fictives.",
    },
    {
      ...customerDefaults,
      id: CUST_HOTEL,
      type: "company",
      first_name: "Hina",
      last_name: "Teva",
      company_name: "Hôtel Tiare Lodge",
      email: "reception@tiarelodge.pf",
      phone: "+689 40 50 60 70",
      address: "Moorea",
      internal_notes:
        "Compte professionnel — facturation fin de mois. Données fictives.",
    },
  ];

  const bookingDefaults = {
    organization_id: ORG_ID,
    created_by: DEMO_USER_ID,
    discount_amount: 0,
    extra_fees_amount: 0,
    confirmed_at: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
  };

  const bookings: Booking[] = [
    {
      ...bookingDefaults,
      id: B1,
      booking_number: `PRC-${year}-0001`,
      customer_id: CUST_JEAN,
      status: "completed",
      start_at: iso(t - 9 * DAY + 8 * HOUR),
      end_at: iso(t - 7 * DAY + 17 * HOUR),
      duration_days: 3,
      subtotal: 23970,
      total_amount: 23970,
      deposit_amount: 50000,
      payment_status: "paid",
      deposit_status: "returned",
      notes: "Nettoyage canapé + moquettes. RAS au retour. (Données fictives)",
      confirmed_at: iso(t - 12 * DAY),
      started_at: iso(t - 9 * DAY),
      completed_at: iso(t - 7 * DAY),
      created_at: iso(t - 12 * DAY),
      updated_at: iso(t - 7 * DAY),
    },
    {
      ...bookingDefaults,
      id: B2,
      booking_number: `PRC-${year}-0002`,
      customer_id: CUST_HOTEL,
      status: "in_progress",
      start_at: iso(t - 1 * DAY),
      end_at: iso(t + 1 * DAY),
      duration_days: 2,
      subtotal: 19980,
      discount_amount: 1980,
      total_amount: 18000,
      deposit_amount: 60000,
      payment_status: "deposit_paid",
      deposit_status: "received",
      notes:
        "Remise commerciale fidélité. Livraison au ponton 9 h. (Données fictives)",
      confirmed_at: iso(t - 3 * DAY),
      started_at: iso(t - 1 * DAY),
      created_at: iso(t - 3 * DAY),
      updated_at: iso(t - 1 * DAY),
    },
    {
      ...bookingDefaults,
      id: B3,
      booking_number: `PRC-${year}-0003`,
      customer_id: CUST_MOANA,
      status: "confirmed",
      start_at: iso(t + 2 * DAY + 8 * HOUR),
      end_at: iso(t + 4 * DAY + 17 * HOUR),
      duration_days: 3,
      subtotal: 23970,
      total_amount: 23970,
      deposit_amount: 50000,
      payment_status: "unpaid",
      deposit_status: "pending",
      notes: "Sièges auto + canapé d'angle. (Données fictives)",
      confirmed_at: iso(t),
      created_at: iso(t),
      updated_at: iso(t),
    },
    {
      ...bookingDefaults,
      id: B4,
      booking_number: `PRC-${year}-0004`,
      customer_id: CUST_JEAN,
      status: "pending",
      start_at: iso(t + 5 * DAY + 8 * HOUR),
      end_at: iso(t + 5 * DAY + 18 * HOUR),
      duration_days: 1,
      subtotal: 6990,
      total_amount: 6990,
      deposit_amount: 40000,
      payment_status: "unpaid",
      deposit_status: "not_required",
      notes: "Demande reçue par téléphone — à confirmer. (Données fictives)",
      created_at: iso(t),
      updated_at: iso(t),
    },
    {
      ...bookingDefaults,
      id: B5_LATE,
      booking_number: `PRC-${year}-0005`,
      customer_id: CUST_MOANA,
      status: "in_progress",
      start_at: iso(t - 3 * DAY),
      end_at: iso(t - 1 * DAY),
      duration_days: 2,
      subtotal: 15980,
      total_amount: 15980,
      deposit_amount: 50000,
      payment_status: "paid",
      deposit_status: "received",
      notes: "Client injoignable depuis hier — relancer. (Données fictives)",
      confirmed_at: iso(t - 4 * DAY),
      started_at: iso(t - 3 * DAY),
      created_at: iso(t - 4 * DAY),
      updated_at: iso(t - 3 * DAY),
    },
  ];

  const item = (
    id: string,
    bookingId: string,
    equipmentId: string,
    dailyPrice: number,
    lineTotal: number
  ): BookingItem => ({
    id,
    organization_id: ORG_ID,
    booking_id: bookingId,
    equipment_id: equipmentId,
    quantity: 1,
    daily_price: dailyPrice,
    pricing_mode: "daily",
    line_total: lineTotal,
    created_at: created,
  });

  const bookingItems: BookingItem[] = [
    item("71111111-1111-4111-8111-111111111111", B1, EQ_PUZZI10, 7990, 23970),
    item("72222222-2222-4222-8222-222222222222", B2, EQ_PACK, 9990, 19980),
    item("73333333-3333-4333-8333-333333333333", B3, EQ_PUZZI10, 7990, 23970),
    item("74444444-4444-4444-8444-444444444444", B4, EQ_PUZZI8, 6990, 6990),
    item("75555555-5555-4555-8555-555555555555", B5_LATE, EQ_PUZZI10, 7990, 15980),
  ];

  let historySeq = 0;
  const hist = (
    bookingId: string,
    from: BookingStatusHistory["from_status"],
    to: BookingStatusHistory["to_status"],
    atMs: number
  ): BookingStatusHistory => ({
    id: `81111111-1111-4111-8111-1111111111${(historySeq++).toString().padStart(2, "0")}`,
    organization_id: ORG_ID,
    booking_id: bookingId,
    from_status: from,
    to_status: to,
    note: null,
    changed_by: DEMO_USER_ID,
    created_at: iso(atMs),
  });

  const history: BookingStatusHistory[] = [
    hist(B1, null, "confirmed", t - 12 * DAY),
    hist(B1, "confirmed", "in_progress", t - 9 * DAY),
    hist(B1, "in_progress", "completed", t - 7 * DAY),
    hist(B2, null, "confirmed", t - 3 * DAY),
    hist(B2, "confirmed", "in_progress", t - 1 * DAY),
    hist(B3, null, "confirmed", t),
    hist(B4, null, "pending", t),
    hist(B5_LATE, null, "confirmed", t - 4 * DAY),
    hist(B5_LATE, "confirmed", "in_progress", t - 3 * DAY),
  ];

  // ----- Agent IA commercial (canaux, boîte de réception, réglages) -----

  const channelDefaults = {
    organization_id: ORG_ID,
    created_at: created,
    updated_at: created,
  };

  const channels: ChannelConnection[] = [
    {
      ...channelDefaults,
      id: CH_MESSENGER,
      channel: "messenger",
      status: "connected",
      display_name: "Pacific Rent&Clean — Page Facebook",
      connected_at: created,
    },
    {
      ...channelDefaults,
      id: CH_GMAIL,
      channel: "gmail",
      status: "connected",
      display_name: "contact@pacific-rentclean.pf",
      connected_at: created,
    },
    {
      ...channelDefaults,
      id: CH_WHATSAPP,
      channel: "whatsapp",
      status: "disconnected",
      display_name: null,
      connected_at: null,
    },
  ];

  const conv = (
    id: string,
    channel: InboxConversation["channel"],
    customerName: string,
    customerContact: string | null,
    customerId: string | null,
    subject: string | null,
    status: InboxConversation["status"],
    lastMs: number
  ): InboxConversation => ({
    id,
    organization_id: ORG_ID,
    channel,
    customer_name: customerName,
    customer_contact: customerContact,
    customer_id: customerId,
    subject,
    status,
    last_message_at: iso(lastMs),
    created_at: iso(lastMs),
    updated_at: iso(lastMs),
  });

  const conversations: InboxConversation[] = [
    conv(
      CONV_PUZZI,
      "messenger",
      "Vaimiti Teriitehau",
      "m.me/vaimiti.teriitehau",
      null,
      null,
      "new",
      t - 2 * HOUR
    ),
    conv(
      CONV_JEAN,
      "gmail",
      "Jean Dupont",
      "jean.dupont@mail.pf",
      CUST_JEAN,
      "Location shampouineuse",
      "new",
      t - 5 * HOUR
    ),
    conv(
      CONV_K5,
      "messenger",
      "Tehani Vairaaroa",
      "m.me/tehani.vairaaroa",
      null,
      null,
      "auto_replied",
      t - 1 * DAY
    ),
    conv(
      CONV_FORM,
      "form",
      "Heiata Wong",
      "heiata.wong@mail.pf",
      null,
      "Demande via le formulaire public",
      "new",
      t - 26 * HOUR
    ),
    conv(
      CONV_COMPLAINT,
      "gmail",
      "Moana Tehani",
      "moana.tehani@mail.pf",
      CUST_MOANA,
      "Problème avec la machine louée",
      "new",
      t - 40 * 60 * 1000
    ),
  ];

  let msgSeq = 0;
  const msg = (
    conversationId: string,
    direction: InboxMessage["direction"],
    author: InboxMessage["author"],
    body: string,
    atMs: number
  ): InboxMessage => ({
    id: `b1111111-1111-4111-8111-1111111111${(msgSeq++).toString().padStart(2, "0")}`,
    organization_id: ORG_ID,
    conversation_id: conversationId,
    direction,
    author,
    body,
    created_at: iso(atMs),
  });

  const inboxMessages: InboxMessage[] = [
    msg(
      CONV_PUZZI,
      "inbound",
      "customer",
      "Bonjour, je voudrais louer un Kärcher Puzzi samedi matin jusqu'à dimanche soir. C'est possible ?",
      t - 2 * HOUR
    ),
    msg(
      CONV_JEAN,
      "inbound",
      "customer",
      "Bonjour,\n\nJe souhaite relouer le Kärcher Puzzi 10/1 de mercredi à vendredi pour refaire les moquettes du salon.\n\nMerci d'avance,\nJean Dupont",
      t - 5 * HOUR
    ),
    msg(
      CONV_K5,
      "inbound",
      "customer",
      "Salut, c'est combien le Kärcher K5 pour une journée ? Il est dispo demain ?",
      t - 1 * DAY - 10 * 60 * 1000
    ),
    msg(
      CONV_K5,
      "outbound",
      "agent",
      "Bonjour 👋\n\nLe Kärcher K5 Premium est à 5 990 XPF la journée (caution 30 000 XPF). Il est actuellement en maintenance : nous ne pouvons malheureusement pas le proposer pour demain. Nous vous prévenons dès qu'il est de nouveau disponible.\n\nL'équipe Pacific Rent&Clean",
      t - 1 * DAY
    ),
    msg(
      CONV_FORM,
      "inbound",
      "customer",
      "Bonjour, est-ce que vous louez des machines pour nettoyer les canapés ? Merci.",
      t - 26 * HOUR
    ),
    msg(
      CONV_COMPLAINT,
      "inbound",
      "customer",
      "Bonjour,\n\nLa machine que je loue s'est arrêtée de fonctionner hier soir, je suis très mécontente. Je demande un remboursement de ma location.\n\nMoana Tehani",
      t - 40 * 60 * 1000
    ),
  ];

  const agentSettings: AgentSettings = {
    organization_id: ORG_ID,
    mode: "auto",
    tone: "warm",
    signature: "L'équipe Pacific Rent&Clean",
    practical_info:
      "Retrait et retour à Papeete, du lundi au samedi de 7 h 30 à 17 h 00. " +
      "Livraison possible sur Tahiti (sur devis). Caution demandée à la remise " +
      "du matériel. (Données fictives)",
    permissions: {
      read_messages: true,
      detect_requests: true,
      check_availability: true,
      compute_prices: true,
      prepare_replies: true,
      auto_reply_simple: true,
      send_form: true,
    },
    notify_new_messages: true,
    notify_email: null,
    activated_at: created,
    updated_at: created,
  };

  // Base de connaissances : ce que l'agent sait répondre en dehors du
  // catalogue et des disponibilités. Un mot-clé touché suffit à déclencher
  // la réponse — elle part telle quelle, sans reformulation.
  const kb = (
    id: string,
    category: string,
    question: string,
    keywords: string[],
    answer: string,
    priority = 0
  ): KnowledgeEntry => ({
    id,
    organization_id: ORG_ID,
    question,
    answer,
    keywords,
    category,
    is_active: true,
    priority,
    created_at: created,
    updated_at: created,
  });

  const knowledgeEntries: KnowledgeEntry[] = [
    kb(
      KB_PAIEMENT,
      "paiement",
      "Comment puis-je payer ma location ?",
      ["paiement", "payer", "carte bancaire", "especes", "virement", "cheque"],
      "Le règlement se fait au retrait du matériel, en espèces, par carte bancaire ou par virement. Une facture vous est remise systématiquement. (Données fictives)"
    ),
    kb(
      KB_CAUTION,
      "caution",
      "Quelle caution demandez-vous ?",
      ["caution", "depot de garantie", "garantie", "empreinte bancaire"],
      "Une caution est demandée à la remise du matériel, par empreinte bancaire ou chèque non encaissé. Elle est restituée au retour, après vérification de l'état de la machine. Son montant dépend du matériel loué et vous est indiqué avant la réservation. (Données fictives)"
    ),
    kb(
      KB_LIVRAISON,
      "livraison",
      "Livrez-vous le matériel à domicile ?",
      ["livraison", "livrez", "domicile", "deplacement", "moorea", "recuperer"],
      "Le retrait se fait à notre dépôt de Papeete. Nous livrons également sur Tahiti, sur devis selon la commune. Pour les îles (Moorea et autres), le transport est à votre charge par la goélette ou le ferry. (Données fictives)"
    ),
    kb(
      KB_HORAIRES,
      "horaires",
      "Quels sont vos horaires d'ouverture ?",
      ["horaire", "ouvert", "ouverture", "samedi", "dimanche", "ferme"],
      "Nous sommes ouverts du lundi au samedi, de 7 h 30 à 17 h 00, sans interruption. Nous sommes fermés le dimanche et les jours fériés. (Données fictives)"
    ),
    kb(
      KB_RETARD,
      "location",
      "Que se passe-t-il si je rends le matériel en retard ?",
      ["retard", "prolonger", "prolongation", "garder plus longtemps", "rendre"],
      "Prévenez-nous dès que possible : si le matériel n'est pas réservé derrière, nous prolongeons simplement votre location au tarif journalier habituel. Sans prévenir, tout jour entamé est facturé. (Données fictives)"
    ),
    kb(
      KB_NETTOYAGE,
      "materiel",
      "Faut-il rendre la machine nettoyée ?",
      ["rendre nettoyee", "rendre propre", "laver la machine", "rincer"],
      "Merci de rendre la machine vidée et rincée, comme elle vous a été remise. Un simple rinçage des cuves et du suceur suffit — nous nous chargeons de l'entretien complet entre deux locations. (Données fictives)"
    ),
  ];

  return {
    version: MOCK_DB_VERSION,
    seededAt: now.toISOString(),
    session: null,
    users: [
      {
        id: DEMO_USER_ID,
        email: "demo@pacific-rentclean.pf",
        firstName: "Teiki",
        lastName: "Démonstration",
      },
    ],
    organization,
    categories,
    equipment,
    customers,
    bookings,
    bookingItems,
    history,
    counters: [{ year, seq: 5 }],
    channels,
    conversations,
    inboxMessages,
    agentSettings,
    knowledgeEntries,
  };
}
