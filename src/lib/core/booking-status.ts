// Machine à états des réservations : transitions autorisées.
// Fonctions pures, testées unitairement.

import type { BookingStatus } from "@/lib/types/database";

export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["pending", "confirmed", "cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

export function canTransition(
  from: BookingStatus,
  to: BookingStatus
): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

/** La réservation bloque-t-elle le planning dans ce statut ? */
export function isBlockingStatus(status: BookingStatus): boolean {
  return ["pending", "confirmed", "in_progress"].includes(status);
}

/** La réservation est-elle encore modifiable (dates, matériels, montants) ? */
export function isEditableStatus(status: BookingStatus): boolean {
  return ["draft", "pending", "confirmed"].includes(status);
}

/** Libellés des actions de transition pour l'UI. */
export const TRANSITION_LABELS: Partial<
  Record<BookingStatus, { label: string; confirm?: string }>
> = {
  pending: { label: "Passer à confirmer" },
  confirmed: { label: "Confirmer" },
  in_progress: { label: "Démarrer la location" },
  completed: { label: "Terminer la location" },
  cancelled: {
    label: "Annuler",
    confirm: "Annuler cette réservation ? Cette action est définitive.",
  },
};
