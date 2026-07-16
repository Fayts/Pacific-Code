"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContextForAction } from "@/lib/auth/context";
import { parseLocalDateTimeInput } from "@/lib/core/dates";
import {
  computeBookingTotals,
  computeDurationDays,
  requiredMinRentalDays,
} from "@/lib/core/pricing";
import { canTransition, isBlockingStatus } from "@/lib/core/booking-status";
import {
  bookingSchema,
  bookingStatusChangeSchema,
  depositStatusChangeSchema,
  paymentStatusChangeSchema,
  localDateTimeSchema,
  bookingItemInputSchema,
} from "@/lib/validations/booking";
import {
  actionError,
  actionOk,
  toUserMessage,
  zodError,
  type ActionResult,
} from "@/server/action-result";
import { logActivity } from "@/server/activity";
import type {
  AvailabilityResult,
  BookingStatus,
  EquipmentItem,
} from "@/lib/types/database";
import { z } from "zod";

function revalidateBookings(id?: string) {
  revalidatePath("/bookings");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/equipment");
  if (id) revalidatePath(`/bookings/${id}`);
}

const AVAILABILITY_REASONS: Record<string, string> = {
  conflict: "déjà réservé sur cette période",
  maintenance: "en maintenance",
  unavailable: "indisponible",
  not_found: "introuvable",
  invalid_period: "période invalide",
};

type EquipmentRow = Pick<
  EquipmentItem,
  | "id"
  | "name"
  | "daily_price"
  | "deposit_amount"
  | "quantity_total"
  | "min_rental_days"
  | "status"
  | "archived_at"
>;

async function fetchOrgEquipment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  equipmentIds: string[]
): Promise<EquipmentRow[]> {
  const { data } = await supabase
    .from("equipment_items")
    .select(
      "id, name, daily_price, deposit_amount, quantity_total, min_rental_days, status, archived_at"
    )
    .eq("organization_id", organizationId)
    .in("id", equipmentIds);
  return data ?? [];
}

// ============================================================
// Vérification de disponibilité (retour détaillé pour le formulaire)
// ============================================================

const availabilityQuerySchema = z.object({
  items: z.array(bookingItemInputSchema).min(1),
  startAt: localDateTimeSchema,
  endAt: localDateTimeSchema,
  excludeBookingId: z.string().uuid().nullable().optional(),
});

export type ItemAvailability = AvailabilityResult & {
  equipmentId: string;
  equipmentName: string;
};

export async function checkBookingAvailability(
  input: unknown
): Promise<ActionResult<{ items: ItemAvailability[]; allAvailable: boolean }>> {
  const parsed = availabilityQuerySchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const context = await requireOrgContextForAction();
  const supabase = await createClient();
  const timezone = context.organization.timezone;

  let startAt: Date;
  let endAt: Date;
  try {
    startAt = parseLocalDateTimeInput(parsed.data.startAt, timezone);
    endAt = parseLocalDateTimeInput(parsed.data.endAt, timezone);
  } catch {
    return actionError("Dates invalides");
  }
  if (endAt <= startAt) {
    return actionError("Le retour doit être après le départ");
  }

  const equipment = await fetchOrgEquipment(
    supabase,
    context.organization.id,
    parsed.data.items.map((i) => i.equipmentId)
  );
  const nameById = new Map(equipment.map((e) => [e.id, e.name]));

  const results: ItemAvailability[] = [];
  for (const item of parsed.data.items) {
    const { data, error } = await supabase.rpc("check_equipment_availability", {
      p_equipment_id: item.equipmentId,
      p_start_at: startAt.toISOString(),
      p_end_at: endAt.toISOString(),
      p_quantity: item.quantity,
      p_exclude_booking_id: parsed.data.excludeBookingId ?? undefined,
    });
    if (error) {
      return actionError("Vérification impossible : " + error.message);
    }
    const availability = data as unknown as AvailabilityResult;
    results.push({
      ...availability,
      equipmentId: item.equipmentId,
      equipmentName: nameById.get(item.equipmentId) ?? "Matériel inconnu",
    });
  }

  return actionOk({
    items: results,
    allAvailable: results.every((r) => r.available),
  });
}

// ============================================================
// Création
// ============================================================

export async function createBooking(
  input: unknown
): Promise<ActionResult<{ bookingId: string }>> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const context = await requireOrgContextForAction();
  const supabase = await createClient();
  const timezone = context.organization.timezone;

  let startAt: Date;
  let endAt: Date;
  try {
    startAt = parseLocalDateTimeInput(parsed.data.startAt, timezone);
    endAt = parseLocalDateTimeInput(parsed.data.endAt, timezone);
  } catch {
    return actionError("Dates invalides");
  }

  let durationDays: number;
  try {
    durationDays = computeDurationDays(startAt, endAt);
  } catch (err) {
    return actionError(toUserMessage(err, "Période invalide"));
  }

  // Le client (navigateur) n'envoie jamais les prix : ils viennent de la base.
  const equipment = await fetchOrgEquipment(
    supabase,
    context.organization.id,
    parsed.data.items.map((i) => i.equipmentId)
  );

  const equipmentById = new Map(equipment.map((e) => [e.id, e]));
  for (const item of parsed.data.items) {
    const row = equipmentById.get(item.equipmentId);
    if (!row) {
      return actionError("Un des matériels sélectionnés est introuvable");
    }
    if (row.archived_at) {
      return actionError(`« ${row.name} » est archivé et ne peut être loué`);
    }
  }

  const minDays = requiredMinRentalDays(
    parsed.data.items.map(
      (i) => equipmentById.get(i.equipmentId)!.min_rental_days
    )
  );
  if (durationDays < minDays) {
    return actionError(
      `Durée minimale de location : ${minDays} jour${minDays > 1 ? "s" : ""}`
    );
  }

  const totals = computeBookingTotals({
    items: parsed.data.items.map((i) => ({
      dailyPrice: equipmentById.get(i.equipmentId)!.daily_price,
      quantity: i.quantity,
    })),
    durationDays,
    discountAmount: parsed.data.discountAmount,
    extraFeesAmount: parsed.data.extraFeesAmount,
  });

  const itemsPayload = parsed.data.items.map((i, index) => ({
    equipment_id: i.equipmentId,
    quantity: i.quantity,
    daily_price: equipmentById.get(i.equipmentId)!.daily_price,
    line_total: totals.lineTotals[index],
  }));

  const { data: bookingId, error } = await supabase.rpc("create_booking", {
    p_organization_id: context.organization.id,
    p_customer_id: parsed.data.customerId,
    p_start_at: startAt.toISOString(),
    p_end_at: endAt.toISOString(),
    p_duration_days: durationDays,
    p_items: itemsPayload,
    p_subtotal: totals.subtotal,
    p_discount_amount: totals.discountAmount,
    p_extra_fees_amount: totals.extraFeesAmount,
    p_total_amount: totals.total,
    p_deposit_amount: parsed.data.depositAmount,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes || null,
  });

  if (error || !bookingId) {
    return actionError(unavailabilityMessage(error?.message, equipmentById));
  }

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "booking.created",
    entityType: "booking",
    entityId: bookingId,
    metadata: { status: parsed.data.status, total: totals.total },
  });

  revalidateBookings(bookingId);
  return actionOk({ bookingId });
}

function unavailabilityMessage(
  message: string | undefined,
  equipmentById: Map<string, EquipmentRow>
): string {
  if (!message) return "Création de la réservation impossible";
  const match = message.match(/EQUIPMENT_UNAVAILABLE:([0-9a-f-]{36}):(\w+)/);
  if (match) {
    const name = equipmentById.get(match[1])?.name ?? "Un matériel";
    const reason = AVAILABILITY_REASONS[match[2]] ?? "non disponible";
    return `« ${name} » : ${reason}. Ajustez les dates ou retirez ce matériel.`;
  }
  return "Réservation impossible : " + message;
}

// ============================================================
// Modification
// ============================================================

export async function updateBooking(
  bookingId: string,
  input: unknown
): Promise<ActionResult<undefined>> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const context = await requireOrgContextForAction();
  const supabase = await createClient();
  const timezone = context.organization.timezone;

  let startAt: Date;
  let endAt: Date;
  try {
    startAt = parseLocalDateTimeInput(parsed.data.startAt, timezone);
    endAt = parseLocalDateTimeInput(parsed.data.endAt, timezone);
  } catch {
    return actionError("Dates invalides");
  }

  let durationDays: number;
  try {
    durationDays = computeDurationDays(startAt, endAt);
  } catch (err) {
    return actionError(toUserMessage(err, "Période invalide"));
  }

  const equipment = await fetchOrgEquipment(
    supabase,
    context.organization.id,
    parsed.data.items.map((i) => i.equipmentId)
  );
  const equipmentById = new Map(equipment.map((e) => [e.id, e]));
  for (const item of parsed.data.items) {
    if (!equipmentById.get(item.equipmentId)) {
      return actionError("Un des matériels sélectionnés est introuvable");
    }
  }

  const totals = computeBookingTotals({
    items: parsed.data.items.map((i) => ({
      dailyPrice: equipmentById.get(i.equipmentId)!.daily_price,
      quantity: i.quantity,
    })),
    durationDays,
    discountAmount: parsed.data.discountAmount,
    extraFeesAmount: parsed.data.extraFeesAmount,
  });

  const itemsPayload = parsed.data.items.map((i, index) => ({
    equipment_id: i.equipmentId,
    quantity: i.quantity,
    daily_price: equipmentById.get(i.equipmentId)!.daily_price,
    line_total: totals.lineTotals[index],
  }));

  const { error } = await supabase.rpc("update_booking_details", {
    p_booking_id: bookingId,
    p_customer_id: parsed.data.customerId,
    p_start_at: startAt.toISOString(),
    p_end_at: endAt.toISOString(),
    p_duration_days: durationDays,
    p_items: itemsPayload,
    p_subtotal: totals.subtotal,
    p_discount_amount: totals.discountAmount,
    p_extra_fees_amount: totals.extraFeesAmount,
    p_total_amount: totals.total,
    p_deposit_amount: parsed.data.depositAmount,
    p_notes: parsed.data.notes || null,
  });

  if (error) {
    return actionError(unavailabilityMessage(error.message, equipmentById));
  }

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "booking.updated",
    entityType: "booking",
    entityId: bookingId,
  });

  revalidateBookings(bookingId);
  return actionOk(undefined);
}

// ============================================================
// Changement de statut
// ============================================================

export async function changeBookingStatus(
  input: unknown
): Promise<ActionResult<undefined>> {
  const parsed = bookingStatusChangeSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, start_at, end_at, booking_number")
    .eq("id", parsed.data.bookingId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!booking) {
    return actionError("Réservation introuvable");
  }

  const from = booking.status as BookingStatus;
  const to = parsed.data.status;

  if (from === to) {
    return actionOk(undefined);
  }
  if (!canTransition(from, to)) {
    return actionError(
      `Passage impossible de « ${from} » à « ${to} »`
    );
  }

  // La réservation devient bloquante : revérifier la disponibilité.
  if (!isBlockingStatus(from) && isBlockingStatus(to)) {
    const { data: items } = await supabase
      .from("booking_items")
      .select("equipment_id, quantity, equipment_items(name)")
      .eq("booking_id", booking.id);

    for (const item of items ?? []) {
      const { data } = await supabase.rpc("check_equipment_availability", {
        p_equipment_id: item.equipment_id,
        p_start_at: booking.start_at,
        p_end_at: booking.end_at,
        p_quantity: item.quantity,
        p_exclude_booking_id: booking.id,
      });
      const availability = data as unknown as AvailabilityResult | null;
      if (availability && !availability.available) {
        const name =
          (item.equipment_items as unknown as { name: string } | null)?.name ??
          "Un matériel";
        const reason =
          AVAILABILITY_REASONS[availability.reason ?? "conflict"] ??
          "non disponible";
        return actionError(`« ${name} » : ${reason}.`);
      }
    }
  }

  const now = new Date().toISOString();
  const timestamps: Record<string, string> = {};
  if (to === "confirmed") timestamps.confirmed_at = now;
  if (to === "in_progress") timestamps.started_at = now;
  if (to === "completed") timestamps.completed_at = now;
  if (to === "cancelled") timestamps.cancelled_at = now;

  const { error } = await supabase
    .from("bookings")
    .update({ status: to, ...timestamps })
    .eq("id", booking.id)
    .eq("organization_id", context.organization.id);

  if (error) {
    return actionError("Changement de statut impossible : " + error.message);
  }

  await supabase.from("booking_status_history").insert({
    organization_id: context.organization.id,
    booking_id: booking.id,
    from_status: from,
    to_status: to,
    note: parsed.data.note || null,
    changed_by: context.userId,
  });

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "booking.status_changed",
    entityType: "booking",
    entityId: booking.id,
    metadata: { from, to, booking_number: booking.booking_number },
  });

  revalidateBookings(booking.id);
  return actionOk(undefined);
}

export async function changePaymentStatus(
  input: unknown
): Promise<ActionResult<undefined>> {
  const parsed = paymentStatusChangeSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { error } = await supabase
    .from("bookings")
    .update({ payment_status: parsed.data.paymentStatus })
    .eq("id", parsed.data.bookingId)
    .eq("organization_id", context.organization.id);

  if (error) {
    return actionError("Mise à jour impossible : " + error.message);
  }

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "booking.payment_status_changed",
    entityType: "booking",
    entityId: parsed.data.bookingId,
    metadata: { payment_status: parsed.data.paymentStatus },
  });

  revalidateBookings(parsed.data.bookingId);
  return actionOk(undefined);
}

export async function changeDepositStatus(
  input: unknown
): Promise<ActionResult<undefined>> {
  const parsed = depositStatusChangeSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { error } = await supabase
    .from("bookings")
    .update({ deposit_status: parsed.data.depositStatus })
    .eq("id", parsed.data.bookingId)
    .eq("organization_id", context.organization.id);

  if (error) {
    return actionError("Mise à jour impossible : " + error.message);
  }

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "booking.deposit_status_changed",
    entityType: "booking",
    entityId: parsed.data.bookingId,
    metadata: { deposit_status: parsed.data.depositStatus },
  });

  revalidateBookings(parsed.data.bookingId);
  return actionOk(undefined);
}

// ============================================================
// Duplication (nouveau brouillon avec les mêmes lignes)
// ============================================================

export async function duplicateBooking(
  bookingId: string
): Promise<ActionResult<{ bookingId: string }>> {
  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { data: source } = await supabase
    .from("bookings")
    .select("*, booking_items(*)")
    .eq("id", bookingId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!source) {
    return actionError("Réservation introuvable");
  }

  const items = (source.booking_items ?? []).map(
    (i: {
      equipment_id: string;
      quantity: number;
      daily_price: number;
      line_total: number;
    }) => ({
      equipment_id: i.equipment_id,
      quantity: i.quantity,
      daily_price: i.daily_price,
      line_total: i.line_total,
    })
  );

  if (items.length === 0) {
    return actionError("La réservation source ne contient aucun matériel");
  }

  const { data: newId, error } = await supabase.rpc("create_booking", {
    p_organization_id: context.organization.id,
    p_customer_id: source.customer_id,
    p_start_at: source.start_at,
    p_end_at: source.end_at,
    p_duration_days: source.duration_days,
    p_items: items,
    p_subtotal: source.subtotal,
    p_discount_amount: source.discount_amount,
    p_extra_fees_amount: source.extra_fees_amount,
    p_total_amount: source.total_amount,
    p_deposit_amount: source.deposit_amount,
    p_status: "draft",
    p_notes: source.notes,
  });

  if (error || !newId) {
    return actionError("Duplication impossible : " + error?.message);
  }

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "booking.duplicated",
    entityType: "booking",
    entityId: newId,
    metadata: { source_booking: source.booking_number },
  });

  revalidateBookings(newId);
  return actionOk({ bookingId: newId });
}
