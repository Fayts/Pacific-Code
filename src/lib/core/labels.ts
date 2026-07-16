// Libellés français et styles des statuts — source unique pour toute l'UI.

import type {
  BookingStatus,
  BusinessType,
  CustomerType,
  DepositStatus,
  EquipmentStatus,
  PaymentStatus,
} from "@/lib/types/database";

// « en retard » est un état dérivé (in_progress avec retour dépassé).
export type DerivedBookingStatus = BookingStatus | "late";

// Statut d'affichage du matériel : réservé / en location sont dérivés
// des réservations, archivé de archived_at.
export type EquipmentDisplayStatus =
  | EquipmentStatus
  | "reserved"
  | "rented"
  | "archived";

type BadgeStyle = { label: string; className: string };

export const BOOKING_STATUS: Record<DerivedBookingStatus, BadgeStyle> = {
  draft: {
    label: "Brouillon",
    className: "bg-neutral-100 text-neutral-700 border-neutral-200",
  },
  pending: {
    label: "À confirmer",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  confirmed: {
    label: "Confirmée",
    className: "bg-blue-50 text-blue-800 border-blue-200",
  },
  in_progress: {
    label: "En cours",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  completed: {
    label: "Terminée",
    className: "bg-neutral-100 text-neutral-600 border-neutral-200",
  },
  cancelled: {
    label: "Annulée",
    className: "bg-neutral-100 text-neutral-500 border-neutral-200 line-through",
  },
  late: {
    label: "En retard",
    className: "bg-red-50 text-red-800 border-red-200",
  },
};

export const PAYMENT_STATUS: Record<PaymentStatus, BadgeStyle> = {
  unpaid: {
    label: "Non payé",
    className: "bg-red-50 text-red-800 border-red-200",
  },
  deposit_paid: {
    label: "Acompte payé",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  paid: {
    label: "Payé",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  refunded: {
    label: "Remboursé",
    className: "bg-neutral-100 text-neutral-600 border-neutral-200",
  },
};

export const DEPOSIT_STATUS: Record<DepositStatus, BadgeStyle> = {
  not_required: {
    label: "Non demandée",
    className: "bg-neutral-100 text-neutral-600 border-neutral-200",
  },
  pending: {
    label: "En attente",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  received: {
    label: "Reçue",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  returned: {
    label: "Restituée",
    className: "bg-blue-50 text-blue-800 border-blue-200",
  },
  partially_withheld: {
    label: "Retenue partielle",
    className: "bg-orange-50 text-orange-800 border-orange-200",
  },
  withheld: {
    label: "Retenue totale",
    className: "bg-red-50 text-red-800 border-red-200",
  },
};

export const EQUIPMENT_STATUS: Record<EquipmentDisplayStatus, BadgeStyle> = {
  available: {
    label: "Disponible",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  reserved: {
    label: "Réservé",
    className: "bg-blue-50 text-blue-800 border-blue-200",
  },
  rented: {
    label: "En location",
    className: "bg-violet-50 text-violet-800 border-violet-200",
  },
  maintenance: {
    label: "En maintenance",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  unavailable: {
    label: "Indisponible",
    className: "bg-neutral-100 text-neutral-600 border-neutral-200",
  },
  archived: {
    label: "Archivé",
    className: "bg-neutral-100 text-neutral-500 border-neutral-200",
  },
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  equipment: "Location de matériel",
  vehicles: "Location de véhicules",
  nautical: "Location nautique",
  events: "Location événementielle",
  other: "Autre",
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: "Particulier",
  company: "Professionnel",
};

// Couleurs des réservations dans le calendrier (pastilles + fonds doux).
export const CALENDAR_STATUS_COLORS: Record<DerivedBookingStatus, string> = {
  draft: "bg-neutral-200 text-neutral-800",
  pending: "bg-amber-200 text-amber-900",
  confirmed: "bg-blue-200 text-blue-900",
  in_progress: "bg-emerald-200 text-emerald-900",
  completed: "bg-neutral-100 text-neutral-500",
  cancelled: "bg-neutral-100 text-neutral-400 line-through",
  late: "bg-red-200 text-red-900",
};

/** Statut affiché d'une réservation, en tenant compte du retard. */
export function derivedBookingStatus(
  status: BookingStatus,
  endAt: Date | string,
  now: Date = new Date()
): DerivedBookingStatus {
  const end = typeof endAt === "string" ? new Date(endAt) : endAt;
  if (status === "in_progress" && end < now) {
    return "late";
  }
  return status;
}
