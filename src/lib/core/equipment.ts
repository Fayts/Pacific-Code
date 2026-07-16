// Statut d'affichage du matériel, dérivé du statut opérationnel
// et des réservations actives sur l'instant courant.

import type { EquipmentDisplayStatus } from "@/lib/core/labels";
import type { EquipmentItem } from "@/lib/types/database";

export type EquipmentBookingLoad = {
  /** Quantité actuellement sortie (réservations in_progress couvrant maintenant). */
  rentedNow: number;
  /** Quantité bloquée par des réservations confirmées/à confirmer couvrant maintenant. */
  reservedNow: number;
};

export type EquipmentDisplayInfo = {
  status: EquipmentDisplayStatus;
  availableNow: number;
};

/**
 * Priorité : archivé > maintenance > indisponible > en location > réservé > disponible.
 * « En location » / « Réservé » s'affichent quand plus aucun exemplaire n'est libre ;
 * sinon le matériel reste « Disponible » avec le compteur d'exemplaires libres.
 */
export function computeEquipmentDisplay(
  item: Pick<EquipmentItem, "status" | "archived_at" | "quantity_total">,
  load: EquipmentBookingLoad
): EquipmentDisplayInfo {
  if (item.archived_at) {
    return { status: "archived", availableNow: 0 };
  }
  if (item.status === "maintenance") {
    return { status: "maintenance", availableNow: 0 };
  }
  if (item.status === "unavailable") {
    return { status: "unavailable", availableNow: 0 };
  }

  const availableNow = Math.max(
    0,
    item.quantity_total - load.rentedNow - load.reservedNow
  );

  if (availableNow > 0) {
    return { status: "available", availableNow };
  }
  if (load.rentedNow > 0) {
    return { status: "rented", availableNow: 0 };
  }
  return { status: "reserved", availableNow: 0 };
}
