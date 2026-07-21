// Service Réservations — toutes les règles métier passent ici :
// validation zod, conversion fuseau → UTC, durée minimale, disponibilité,
// prix recalculés depuis le catalogue (jamais depuis le formulaire).
// Le repository sous-jacent (mock aujourd'hui, Supabase demain) ne fait
// que persister.

import { z } from "zod";
import { getDataProvider } from "@/lib/data";
import type { DataProvider } from "@/lib/data/repositories";
import {
  bookingSchema,
  bookingItemInputSchema,
  localDateTimeSchema,
} from "@/lib/validations/booking";
import { parseLocalDateTimeInput } from "@/lib/core/dates";
import {
  computeBookingTotals,
  computeDurationDays,
  requiredMinRentalDays,
} from "@/lib/core/pricing";
import {
  actionError,
  actionOk,
  toUserMessage,
  zodError,
  type ActionResult,
} from "@/server/action-result";
import type {
  AvailabilityResult,
  Booking,
  BookingStatus,
  DepositStatus,
  PaymentStatus,
} from "@/lib/types/database";

const AVAILABILITY_REASONS: Record<string, string> = {
  conflict: "déjà réservé sur cette période",
  maintenance: "en maintenance",
  unavailable: "indisponible",
  not_found: "introuvable",
  invalid_period: "période invalide",
};

export type ItemAvailability = AvailabilityResult & {
  equipmentId: string;
  equipmentName: string;
};

type PreparedBooking = {
  draft: Parameters<DataProvider["bookings"]["create"]>[0];
  pricing: Parameters<DataProvider["bookings"]["create"]>[1];
  unavailable: ItemAvailability[];
};

async function prepare(
  provider: DataProvider,
  input: z.infer<typeof bookingSchema>,
  excludeBookingId?: string | null
): Promise<ActionResult<PreparedBooking>> {
  const org = await provider.organization.get();
  if (!org) return actionError("Aucune organisation active — reconnectez-vous.");

  let startAt: Date;
  let endAt: Date;
  try {
    startAt = parseLocalDateTimeInput(input.startAt, org.timezone);
    endAt = parseLocalDateTimeInput(input.endAt, org.timezone);
  } catch {
    return actionError("Dates invalides");
  }

  let durationDays: number;
  try {
    durationDays = computeDurationDays(startAt, endAt);
  } catch (err) {
    return actionError(toUserMessage(err, "Période invalide"));
  }

  const equipment = await provider.equipment.list({ includeArchived: true });
  const byId = new Map(equipment.map((e) => [e.id, e]));

  for (const item of input.items) {
    const row = byId.get(item.equipmentId);
    if (!row) {
      return actionError("Un des matériels sélectionnés est introuvable");
    }
    if (row.archived_at) {
      return actionError(`« ${row.name} » est archivé et ne peut être loué`);
    }
  }

  const minDays = requiredMinRentalDays(
    input.items.map((i) => byId.get(i.equipmentId)!.min_rental_days)
  );
  if (durationDays < minDays) {
    return actionError(
      `Durée minimale de location : ${minDays} jour${minDays > 1 ? "s" : ""}`
    );
  }

  const unavailable: ItemAvailability[] = [];
  for (const item of input.items) {
    const availability = await provider.bookings.checkAvailability({
      equipmentId: item.equipmentId,
      startAtIso: startAt.toISOString(),
      endAtIso: endAt.toISOString(),
      quantity: item.quantity,
      excludeBookingId,
    });
    if (!availability.available) {
      unavailable.push({
        ...availability,
        equipmentId: item.equipmentId,
        equipmentName: byId.get(item.equipmentId)!.name,
      });
    }
  }

  const totals = computeBookingTotals({
    items: input.items.map((i) => ({
      dailyPrice: byId.get(i.equipmentId)!.daily_price,
      quantity: i.quantity,
    })),
    durationDays,
    discountAmount: input.discountAmount,
    extraFeesAmount: input.extraFeesAmount,
  });

  return actionOk({
    draft: {
      customerId: input.customerId,
      items: input.items.map((i) => ({
        equipmentId: i.equipmentId,
        quantity: i.quantity,
      })),
      startAtIso: startAt.toISOString(),
      endAtIso: endAt.toISOString(),
      durationDays,
      discountAmount: totals.discountAmount,
      extraFeesAmount: totals.extraFeesAmount,
      depositAmount: Math.max(0, input.depositAmount),
      notes: input.notes ?? "",
      status: input.status,
    },
    pricing: {
      lineTotals: totals.lineTotals,
      subtotal: totals.subtotal,
      total: totals.total,
    },
    unavailable,
  });
}

function unavailabilityMessage(unavailable: ItemAvailability[]): string {
  const first = unavailable[0];
  const reason = AVAILABILITY_REASONS[first.reason ?? "conflict"] ?? "non disponible";
  return `« ${first.equipmentName} » : ${reason}. Ajustez les dates ou retirez ce matériel.`;
}

// ------------------------------------------------------------
// API du service
// ------------------------------------------------------------

export async function createBooking(
  input: unknown,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<{ bookingId: string }>> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const prepared = await prepare(provider, parsed.data);
  if (!prepared.ok) return prepared;

  // Un brouillon ne bloque pas le planning : création tolérée malgré un
  // conflit (l'UI l'affiche en avertissement). Tout autre statut est refusé.
  if (prepared.data.unavailable.length > 0 && parsed.data.status !== "draft") {
    return actionError(unavailabilityMessage(prepared.data.unavailable));
  }

  try {
    const booking = await provider.bookings.create(
      prepared.data.draft,
      prepared.data.pricing
    );
    return actionOk({ bookingId: booking.id });
  } catch (err) {
    // Course possible en mode réel : la disponibilité est revérifiée dans
    // la transaction SQL, qui peut refuser malgré le contrôle ci-dessus.
    return actionError(toUserMessage(err, "Création impossible, réessayez."));
  }
}

export async function updateBooking(
  bookingId: string,
  input: unknown,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const existing = await provider.bookings.get(bookingId);
  if (!existing) return actionError("Réservation introuvable");
  if (!["draft", "pending", "confirmed"].includes(existing.status)) {
    return actionError(
      "Cette réservation ne peut plus être modifiée (statut : " +
        existing.status +
        ")"
    );
  }

  const prepared = await prepare(provider, parsed.data, bookingId);
  if (!prepared.ok) return prepared;

  if (prepared.data.unavailable.length > 0 && existing.status !== "draft") {
    return actionError(unavailabilityMessage(prepared.data.unavailable));
  }

  try {
    const updated = await provider.bookings.update(
      bookingId,
      { ...prepared.data.draft, status: existing.status as never },
      prepared.data.pricing
    );
    if (!updated) return actionError("Réservation introuvable");
    return actionOk(undefined);
  } catch (err) {
    return actionError(toUserMessage(err, "Modification impossible, réessayez."));
  }
}

export async function changeBookingStatus(
  input: unknown,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const schema = z.object({
    bookingId: z.string().uuid(),
    status: z.enum([
      "draft",
      "pending",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
    ]),
    note: z.string().trim().max(1000).optional().or(z.literal("")),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const result = await provider.bookings.changeStatus(
    parsed.data.bookingId,
    parsed.data.status as BookingStatus,
    parsed.data.note || undefined
  );
  return result.ok
    ? actionOk(undefined)
    : actionError(result.error ?? "Changement de statut impossible");
}

export async function setPaymentStatus(
  bookingId: string,
  status: PaymentStatus,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  // Le provider ignore silencieusement un id inconnu : on vérifie d'abord
  // pour ne pas renvoyer un faux succès à l'UI (optimistic update non annulé).
  const existing = await provider.bookings.get(bookingId);
  if (!existing) return actionError("Réservation introuvable");
  await provider.bookings.setPaymentStatus(bookingId, status);
  return actionOk(undefined);
}

export async function setDepositStatus(
  bookingId: string,
  status: DepositStatus,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const existing = await provider.bookings.get(bookingId);
  if (!existing) return actionError("Réservation introuvable");
  await provider.bookings.setDepositStatus(bookingId, status);
  return actionOk(undefined);
}

export async function duplicateBooking(
  bookingId: string,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<{ bookingId: string }>> {
  const copy: Booking | null = await provider.bookings.duplicate(bookingId);
  return copy
    ? actionOk({ bookingId: copy.id })
    : actionError("Duplication impossible");
}

/** Vérification de disponibilité en direct pour le formulaire de réservation. */
export async function checkBookingAvailability(
  input: unknown,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<{ items: ItemAvailability[]; allAvailable: boolean }>> {
  const schema = z.object({
    items: z.array(bookingItemInputSchema).min(1),
    startAt: localDateTimeSchema,
    endAt: localDateTimeSchema,
    excludeBookingId: z.string().uuid().nullable().optional(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const org = await provider.organization.get();
  if (!org) return actionError("Aucune organisation active — reconnectez-vous.");
  let startAt: Date;
  let endAt: Date;
  try {
    startAt = parseLocalDateTimeInput(parsed.data.startAt, org.timezone);
    endAt = parseLocalDateTimeInput(parsed.data.endAt, org.timezone);
  } catch {
    return actionError("Dates invalides");
  }
  if (endAt <= startAt) {
    return actionError("Le retour doit être après le départ");
  }

  const equipment = await provider.equipment.list({ includeArchived: true });
  const nameById = new Map(equipment.map((e) => [e.id, e.name]));

  const results: ItemAvailability[] = [];
  for (const item of parsed.data.items) {
    const availability = await provider.bookings.checkAvailability({
      equipmentId: item.equipmentId,
      startAtIso: startAt.toISOString(),
      endAtIso: endAt.toISOString(),
      quantity: item.quantity,
      excludeBookingId: parsed.data.excludeBookingId,
    });
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
