// Libellés français et styles des statuts — source unique pour toute l'UI.

import type {
  BookingStatus,
  BusinessType,
  CustomerType,
  DepositStatus,
  EquipmentStatus,
  PaymentStatus,
} from "@/lib/types/database";
import type { ChannelKind, ConversationStatus } from "@/lib/types/inbox";

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
    className: "bg-muted text-muted-foreground border-border",
  },
  pending: {
    label: "À confirmer",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  confirmed: {
    label: "Confirmée",
    className: "bg-cyan-50 text-cyan-800 border-cyan-200",
  },
  in_progress: {
    label: "En cours",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  completed: {
    label: "Terminée",
    className: "bg-muted text-muted-foreground border-border",
  },
  cancelled: {
    label: "Annulée",
    className: "bg-muted text-muted-foreground/70 border-border line-through",
  },
  late: {
    label: "En retard",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export const PAYMENT_STATUS: Record<PaymentStatus, BadgeStyle> = {
  unpaid: {
    label: "Non payé",
    className: "bg-red-50 text-red-700 border-red-200",
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
    className: "bg-muted text-muted-foreground border-border",
  },
};

export const DEPOSIT_STATUS: Record<DepositStatus, BadgeStyle> = {
  not_required: {
    label: "Non demandée",
    className: "bg-muted text-muted-foreground border-border",
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
    className: "bg-cyan-50 text-cyan-800 border-cyan-200",
  },
  partially_withheld: {
    label: "Retenue partielle",
    className: "bg-orange-50 text-orange-800 border-orange-200",
  },
  withheld: {
    label: "Retenue totale",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export const EQUIPMENT_STATUS: Record<EquipmentDisplayStatus, BadgeStyle> = {
  available: {
    label: "Disponible",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  reserved: {
    label: "Réservé",
    className: "bg-cyan-50 text-cyan-800 border-cyan-200",
  },
  rented: {
    label: "En location",
    className: "bg-orange-50 text-orange-800 border-orange-200",
  },
  maintenance: {
    label: "En maintenance",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  unavailable: {
    label: "Indisponible",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
  archived: {
    label: "Archivé",
    className: "bg-muted text-muted-foreground/70 border-border",
  },
};

export const CONVERSATION_STATUS: Record<ConversationStatus, BadgeStyle> = {
  new: {
    label: "Nouveau",
    className: "bg-cyan-50 text-cyan-800 border-cyan-200",
  },
  auto_replied: {
    label: "Répondu auto",
    className: "bg-violet-50 text-violet-800 border-violet-200",
  },
  replied: {
    label: "Répondu",
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  transferred: {
    label: "Transféré",
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  ignored: {
    label: "Ignoré",
    className: "bg-muted text-muted-foreground/70 border-border",
  },
};

export const CHANNEL_LABELS: Record<ChannelKind, string> = {
  messenger: "Messenger",
  gmail: "Gmail",
  outlook: "Outlook",
  whatsapp: "WhatsApp",
  form: "Formulaire",
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
  draft: "bg-slate-200 text-slate-700",
  pending: "bg-amber-200 text-amber-900",
  confirmed: "bg-cyan-200 text-cyan-900",
  in_progress: "bg-emerald-200 text-emerald-900",
  completed: "bg-slate-100 text-slate-500",
  cancelled: "bg-slate-100 text-slate-400 line-through",
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
