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
import type { SessionUser } from "@/lib/data/repositories";

export const MOCK_DB_VERSION = 1;

// IDs stables (format UUID pour rester compatibles avec les validations zod).
export const ORG_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_USER_ID = "22222222-2222-4222-8222-222222222222";
const CAT_INJECTEUR = "31111111-1111-4111-8111-111111111111";
const CAT_PACK = "32222222-2222-4222-8222-222222222222";
const CAT_HP = "33333333-3333-4333-8333-333333333333";
export const EQ_PUZZI10 = "41111111-1111-4111-8111-111111111111";
export const EQ_PUZZI8 = "42222222-2222-4222-8222-222222222222";
export const EQ_PACK = "43333333-3333-4333-8333-333333333333";
export const EQ_K5 = "44444444-4444-4444-8444-444444444444";
export const CUST_JEAN = "51111111-1111-4111-8111-111111111111";
export const CUST_MOANA = "52222222-2222-4222-8222-222222222222";
export const CUST_HOTEL = "53333333-3333-4333-8333-333333333333";
const B1 = "61111111-1111-4111-8111-111111111111";
const B2 = "62222222-2222-4222-8222-222222222222";
const B3 = "63333333-3333-4333-8333-333333333333";
const B4 = "64444444-4444-4444-8444-444444444444";
export const B5_LATE = "65555555-5555-4555-8555-555555555555";

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
  ];

  const equipmentDefaults = {
    organization_id: ORG_ID,
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
  };
}
