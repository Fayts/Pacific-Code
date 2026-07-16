import type { Booking, CatalogItem, Customer, DeliveryStop } from "./types";

/* -------------------------------------------------------------------------- */
/*  Données de démonstration — 100 % fictives, stockées en local.             */
/*  À remplacer plus tard par Supabase (tables produits, réservations, etc.)  */
/* -------------------------------------------------------------------------- */

export const COMPANY = {
  name: "Pacific Rent&Clean",
  tagline: "Location de matériel de nettoyage & prestations à domicile",
  phone: "+689 87 12 34 56",
  email: "contact@pacificrentclean.pf",
  address: "Papeete, Tahiti — Polynésie française",
  deliveryZone: "Livraison incluse entre Papenoo et Papeete",
  deliverySurcharge: 1500,
};

/** Communes desservies sans supplément (corridor Papenoo → Papeete) */
export const FREE_DELIVERY_COMMUNES = [
  "Papenoo",
  "Mahina",
  "Arue",
  "Pirae",
  "Papeete",
];

/** Communes desservies avec supplément de 1 500 XPF */
export const SURCHARGE_COMMUNES = [
  "Faa'a",
  "Punaauia",
  "Paea",
  "Papara",
  "Taravao",
];

export const ALL_COMMUNES = [...FREE_DELIVERY_COMMUNES, ...SURCHARGE_COMMUNES];

export function deliveryFeeFor(commune: string): number {
  return FREE_DELIVERY_COMMUNES.includes(commune) ? 0 : COMPANY.deliverySurcharge;
}

export const TIME_SLOTS = [
  "08h00 – 10h00",
  "10h00 – 12h00",
  "13h00 – 15h00",
  "15h00 – 17h00",
];

/* ------------------------------- Catalogue -------------------------------- */

export const CATALOG: CatalogItem[] = [
  {
    slug: "karcher-puzzi-10-1",
    category: "location",
    name: "Kärcher Puzzi 10/1",
    shortDescription:
      "Injecteur-extracteur professionnel pour canapés, matelas, moquettes et sièges auto.",
    description:
      "Le Puzzi 10/1 pulvérise une solution nettoyante au cœur des fibres puis aspire l'eau sale en un seul passage. Résultat : des textiles propres en profondeur, désodorisés et secs en quelques heures. Simple à prendre en main, il est livré prêt à l'emploi avec ses accessoires et une dose de détergent.",
    price: 8500,
    priceUnit: "/ jour",
    deposit: 25000,
    features: [
      "Cuve 10 L eau propre / 9 L récupération",
      "Buse manuelle textile + suceur sol",
      "Puissance d'aspiration 1 100 W",
      "Séchage rapide des tissus",
    ],
    included: [
      "Dose de détergent RM 760 offerte",
      "Notice d'utilisation simplifiée",
      "Accessoires canapé, matelas et auto",
      "Assistance téléphonique 7j/7",
    ],
    popular: true,
    icon: "machine",
  },
  {
    slug: "pack-auto-home",
    category: "location",
    name: "Pack Auto-Home",
    shortDescription:
      "Le combo complet : injecteur-extracteur + accessoires auto et maison pour tout nettoyer en un week-end.",
    description:
      "Pensé pour ceux qui veulent tout rafraîchir d'un coup : sièges et moquettes de la voiture, canapé du salon, matelas des chambres. Le Pack Auto-Home réunit l'injecteur-extracteur, l'ensemble des embouts spécialisés et deux doses de détergent pour une remise à neuf complète de vos textiles.",
    price: 12500,
    priceUnit: "/ week-end",
    deposit: 25000,
    features: [
      "Injecteur-extracteur Kärcher inclus",
      "Kit complet auto : buses sièges & tapis",
      "Kit maison : canapé, matelas, moquette",
      "Durée week-end (vendredi → lundi)",
    ],
    included: [
      "2 doses de détergent offertes",
      "Guide d'utilisation pas à pas",
      "Livraison prioritaire",
      "Assistance téléphonique 7j/7",
    ],
    popular: true,
    icon: "pack",
  },
  {
    slug: "nettoyage-canape",
    category: "prestation",
    name: "Nettoyage de canapé",
    shortDescription:
      "Nettoyage en profondeur de votre canapé à domicile : taches, odeurs et acariens éliminés.",
    description:
      "Notre technicien se déplace chez vous avec le matériel professionnel. Le tissu est d'abord pré-traité sur les taches, puis nettoyé par injection-extraction. Votre canapé retrouve ses couleurs, débarrassé des odeurs, des acariens et des allergènes. Séchage complet en 3 à 5 heures.",
    price: 14900,
    priceUnit: "/ prestation",
    duration: "1h30 – 2h (canapé 3 places)",
    features: [
      "Pré-traitement des taches inclus",
      "Injection-extraction professionnelle",
      "Produits certifiés, sans danger pour les enfants et animaux",
      "Séchage en 3 à 5 heures",
    ],
    included: [
      "Déplacement dans la zone Papenoo – Papeete",
      "Désodorisation textile",
      "Conseils d'entretien personnalisés",
    ],
    popular: true,
    icon: "sofa",
  },
  {
    slug: "nettoyage-matelas",
    category: "prestation",
    name: "Nettoyage de matelas",
    shortDescription:
      "Assainissement complet du matelas : acariens, taches et odeurs traités à domicile.",
    description:
      "Un matelas accumule acariens, transpiration et poussières au fil des années. Notre prestation combine aspiration haute puissance, injection-extraction et désinfection textile pour retrouver une literie saine. Idéal pour les personnes allergiques et les chambres d'enfants.",
    price: 9900,
    priceUnit: "/ matelas",
    duration: "1h – 1h30 (matelas 2 places)",
    features: [
      "Aspiration anti-acariens haute puissance",
      "Traitement des taches et auréoles",
      "Désinfection et désodorisation",
      "Convient à toutes les tailles de matelas",
    ],
    included: [
      "Déplacement dans la zone Papenoo – Papeete",
      "Contrôle qualité avant départ",
      "Conseils literie personnalisés",
    ],
    icon: "bed",
  },
];

export function getItem(slug: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.slug === slug);
}

export const LOCATIONS = CATALOG.filter((i) => i.category === "location");
export const PRESTATIONS = CATALOG.filter((i) => i.category === "prestation");

/* -------------------------------- Clients --------------------------------- */

export const CUSTOMERS: Customer[] = [
  {
    id: "c1",
    firstName: "Moana",
    lastName: "Teriipaia",
    email: "moana.teriipaia@mail.pf",
    phone: "+689 87 22 41 08",
    commune: "Pirae",
    bookingsCount: 4,
    totalSpent: 47800,
    createdAt: "2026-03-02",
  },
  {
    id: "c2",
    firstName: "Hinatea",
    lastName: "Vongue",
    email: "hinatea.v@mail.pf",
    phone: "+689 89 74 12 55",
    commune: "Arue",
    bookingsCount: 2,
    totalSpent: 24800,
    createdAt: "2026-04-18",
  },
  {
    id: "c3",
    firstName: "Teiva",
    lastName: "Maruhi",
    email: "teiva.maruhi@mail.pf",
    phone: "+689 87 65 90 33",
    commune: "Punaauia",
    bookingsCount: 3,
    totalSpent: 41200,
    createdAt: "2026-02-11",
  },
  {
    id: "c4",
    firstName: "Vaimiti",
    lastName: "Lai",
    email: "vaimiti.lai@mail.pf",
    phone: "+689 89 30 18 77",
    commune: "Papeete",
    bookingsCount: 1,
    totalSpent: 14900,
    createdAt: "2026-06-05",
  },
  {
    id: "c5",
    firstName: "Manoa",
    lastName: "Brotherson",
    email: "manoa.b@mail.pf",
    phone: "+689 87 48 02 19",
    commune: "Mahina",
    bookingsCount: 2,
    totalSpent: 21000,
    createdAt: "2026-05-22",
  },
  {
    id: "c6",
    firstName: "Rautea",
    lastName: "Chang",
    email: "rautea.chang@mail.pf",
    phone: "+689 89 11 76 40",
    commune: "Papara",
    bookingsCount: 1,
    totalSpent: 11400,
    createdAt: "2026-07-01",
  },
];

export function getCustomer(id: string): Customer | undefined {
  return CUSTOMERS.find((c) => c.id === id);
}

/* ------------------------------ Réservations ------------------------------ */

export const BOOKINGS: Booking[] = [
  {
    id: "b1",
    reference: "PRC-2607",
    itemSlug: "karcher-puzzi-10-1",
    customerId: "c1",
    date: "2026-07-16",
    endDate: "2026-07-17",
    timeSlot: "08h00 – 10h00",
    mode: "livraison",
    address: "Servitude Teroma, lot 12",
    commune: "Pirae",
    deliveryFee: 0,
    itemPrice: 8500,
    total: 8500,
    status: "en_cours",
    paymentStatus: "paye",
    paymentMethod: "Carte bancaire",
    notes: "Portail bleu, appeler en arrivant.",
    createdAt: "2026-07-12",
  },
  {
    id: "b2",
    reference: "PRC-2608",
    itemSlug: "nettoyage-canape",
    customerId: "c4",
    date: "2026-07-16",
    timeSlot: "13h00 – 15h00",
    mode: "livraison",
    address: "Rue des Remparts, imm. Manuia, apt 4B",
    commune: "Papeete",
    deliveryFee: 0,
    itemPrice: 14900,
    total: 14900,
    status: "confirmee",
    paymentStatus: "en_attente",
    paymentMethod: "Espèces à la prestation",
    notes: "Canapé d'angle 5 places, tissu clair.",
    createdAt: "2026-07-10",
  },
  {
    id: "b3",
    reference: "PRC-2609",
    itemSlug: "pack-auto-home",
    customerId: "c3",
    date: "2026-07-17",
    endDate: "2026-07-20",
    timeSlot: "15h00 – 17h00",
    mode: "livraison",
    address: "PK 12,4 côté montagne",
    commune: "Punaauia",
    deliveryFee: 1500,
    itemPrice: 12500,
    total: 14000,
    status: "confirmee",
    paymentStatus: "paye",
    paymentMethod: "Virement",
    createdAt: "2026-07-09",
  },
  {
    id: "b4",
    reference: "PRC-2610",
    itemSlug: "nettoyage-matelas",
    customerId: "c5",
    date: "2026-07-18",
    timeSlot: "10h00 – 12h00",
    mode: "livraison",
    address: "PK 9 côté mer, maison verte",
    commune: "Mahina",
    deliveryFee: 0,
    itemPrice: 9900,
    total: 9900,
    status: "confirmee",
    paymentStatus: "paye",
    paymentMethod: "Carte bancaire",
    notes: "2 matelas : 1 double + 1 simple (supplément à confirmer).",
    createdAt: "2026-07-11",
  },
  {
    id: "b5",
    reference: "PRC-2611",
    itemSlug: "karcher-puzzi-10-1",
    customerId: "c2",
    date: "2026-07-20",
    endDate: "2026-07-21",
    timeSlot: "08h00 – 10h00",
    mode: "retrait",
    deliveryFee: 0,
    itemPrice: 8500,
    total: 8500,
    status: "en_attente",
    paymentStatus: "en_attente",
    paymentMethod: "À définir",
    createdAt: "2026-07-15",
  },
  {
    id: "b6",
    reference: "PRC-2612",
    itemSlug: "nettoyage-canape",
    customerId: "c6",
    date: "2026-07-22",
    timeSlot: "13h00 – 15h00",
    mode: "livraison",
    address: "PK 36, lotissement Atimaono, villa 8",
    commune: "Papara",
    deliveryFee: 1500,
    itemPrice: 14900,
    total: 16400,
    status: "en_attente",
    paymentStatus: "en_attente",
    paymentMethod: "À définir",
    createdAt: "2026-07-14",
  },
  {
    id: "b7",
    reference: "PRC-2601",
    itemSlug: "pack-auto-home",
    customerId: "c1",
    date: "2026-07-04",
    endDate: "2026-07-06",
    timeSlot: "15h00 – 17h00",
    mode: "livraison",
    address: "Servitude Teroma, lot 12",
    commune: "Pirae",
    deliveryFee: 0,
    itemPrice: 12500,
    total: 12500,
    status: "terminee",
    paymentStatus: "paye",
    paymentMethod: "Carte bancaire",
    createdAt: "2026-06-28",
  },
  {
    id: "b8",
    reference: "PRC-2598",
    itemSlug: "nettoyage-matelas",
    customerId: "c3",
    date: "2026-06-27",
    timeSlot: "08h00 – 10h00",
    mode: "livraison",
    address: "PK 12,4 côté montagne",
    commune: "Punaauia",
    deliveryFee: 1500,
    itemPrice: 9900,
    total: 11400,
    status: "terminee",
    paymentStatus: "paye",
    paymentMethod: "Espèces à la prestation",
    createdAt: "2026-06-20",
  },
  {
    id: "b9",
    reference: "PRC-2594",
    itemSlug: "karcher-puzzi-10-1",
    customerId: "c5",
    date: "2026-06-21",
    endDate: "2026-06-22",
    timeSlot: "10h00 – 12h00",
    mode: "retrait",
    deliveryFee: 0,
    itemPrice: 8500,
    total: 8500,
    status: "terminee",
    paymentStatus: "paye",
    paymentMethod: "Carte bancaire",
    createdAt: "2026-06-15",
  },
  {
    id: "b10",
    reference: "PRC-2590",
    itemSlug: "nettoyage-canape",
    customerId: "c2",
    date: "2026-06-14",
    timeSlot: "13h00 – 15h00",
    mode: "livraison",
    address: "Quartier Erima, résidence Tiare, apt 12",
    commune: "Arue",
    deliveryFee: 0,
    itemPrice: 14900,
    total: 14900,
    status: "annulee",
    paymentStatus: "rembourse",
    paymentMethod: "Carte bancaire",
    notes: "Annulée par la cliente (déplacement professionnel).",
    createdAt: "2026-06-08",
  },
];

export function getBooking(id: string): Booking | undefined {
  return BOOKINGS.find((b) => b.id === id);
}

/** Réservations rattachées au client fictif de l'espace client (Moana) */
export const CURRENT_CLIENT_ID = "c1";

/* ------------------------------- Livraisons ------------------------------- */

export const TODAY_ISO = "2026-07-16";

export const DELIVERY_TOUR: DeliveryStop[] = [
  { bookingId: "b1", type: "livraison", window: "08h00 – 10h00" },
  { bookingId: "b2", type: "livraison", window: "13h00 – 15h00" },
  { bookingId: "b7", type: "recuperation", window: "15h00 – 17h00" },
];

/* ------------------------------- Étiquettes ------------------------------- */

export const BOOKING_STATUS_LABELS: Record<Booking["status"], string> = {
  en_attente: "En attente",
  confirmee: "Confirmée",
  en_cours: "En cours",
  terminee: "Terminée",
  annulee: "Annulée",
};

export const PAYMENT_STATUS_LABELS: Record<Booking["paymentStatus"], string> = {
  en_attente: "En attente",
  paye: "Payé",
  rembourse: "Remboursé",
};
