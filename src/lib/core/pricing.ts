// Calculs de prix et de durée des réservations.
// Fonctions pures, couvertes par des tests unitaires (src/lib/core/__tests__).

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Durée de location en jours facturables.
 * Toute journée entamée est due ; minimum 1 jour.
 * Exemple : 8 h → 18 h le même jour = 1 jour ; 8 h → 9 h le lendemain = 2 jours.
 */
export function computeDurationDays(startAt: Date, endAt: Date): number {
  const elapsed = endAt.getTime() - startAt.getTime();
  if (!Number.isFinite(elapsed) || elapsed <= 0) {
    throw new RangeError("La date de retour doit être après la date de départ");
  }
  return Math.max(1, Math.ceil(elapsed / MS_PER_DAY));
}

export type PricingItem = {
  dailyPrice: number;
  quantity: number;
  /** "flat" : forfait (le prix ne se multiplie pas par la durée). */
  pricingMode?: "daily" | "flat";
};

export type BookingTotals = {
  durationDays: number;
  lineTotals: number[];
  subtotal: number;
  discountAmount: number;
  extraFeesAmount: number;
  total: number;
};

/**
 * Prix d'une réservation :
 * ligne par jour = prix × quantité × jours ; ligne au forfait = prix × quantité.
 * Total = sous-total − remise + frais, jamais sous zéro.
 */
export function computeBookingTotals(params: {
  items: PricingItem[];
  durationDays: number;
  discountAmount?: number;
  extraFeesAmount?: number;
}): BookingTotals {
  const durationDays = Math.max(1, Math.trunc(params.durationDays));
  const discountAmount = round2(Math.max(0, params.discountAmount ?? 0));
  const extraFeesAmount = round2(Math.max(0, params.extraFeesAmount ?? 0));

  const lineTotals = params.items.map((item) => {
    const price = Math.max(0, item.dailyPrice);
    const quantity = Math.max(1, Math.trunc(item.quantity));
    const days = item.pricingMode === "flat" ? 1 : durationDays;
    return round2(price * quantity * days);
  });

  const subtotal = round2(lineTotals.reduce((sum, v) => sum + v, 0));
  const total = round2(Math.max(0, subtotal - discountAmount + extraFeesAmount));

  return {
    durationDays,
    lineTotals,
    subtotal,
    discountAmount,
    extraFeesAmount,
    total,
  };
}

/**
 * Durée minimale exigée par un ensemble de matériels
 * (la plus contraignante l'emporte).
 */
export function requiredMinRentalDays(minDays: number[]): number {
  return minDays.reduce((max, d) => Math.max(max, Math.max(1, d)), 1);
}
