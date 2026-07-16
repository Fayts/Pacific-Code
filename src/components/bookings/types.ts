// Types partagés du module Réservations (formulaire + pages).

import type {
  BookingStatus,
  Customer,
  EquipmentItem,
} from "@/lib/types/database";

/** Client tel qu'exposé au formulaire de réservation. */
export type CustomerOption = Pick<
  Customer,
  "id" | "type" | "first_name" | "last_name" | "company_name" | "email" | "phone"
>;

/** Matériel tel qu'exposé au formulaire de réservation. */
export type EquipmentOption = Pick<
  EquipmentItem,
  | "id"
  | "name"
  | "daily_price"
  | "deposit_amount"
  | "quantity_total"
  | "min_rental_days"
  | "status"
>;

/** Ligne sélectionnée dans le formulaire. */
export type BookingItemDraft = {
  equipmentId: string;
  quantity: number;
};

/** Valeurs initiales du formulaire (mode édition). */
export type BookingFormInitialValues = {
  customerId: string;
  items: BookingItemDraft[];
  startAt: string; // format datetime-local dans le fuseau de l'organisation
  endAt: string;
  discountAmount: number;
  extraFeesAmount: number;
  depositAmount: number;
  notes: string;
  status: BookingStatus;
};
