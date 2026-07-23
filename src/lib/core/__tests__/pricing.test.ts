import { describe, expect, it } from "vitest";

import {
  computeBookingTotals,
  computeDurationDays,
  requiredMinRentalDays,
} from "@/lib/core/pricing";

describe("computeDurationDays", () => {
  it("compte 1 jour pour une location le même jour (8h → 18h)", () => {
    const start = new Date("2026-07-16T08:00:00Z");
    const end = new Date("2026-07-16T18:00:00Z");
    expect(computeDurationDays(start, end)).toBe(1);
  });

  it("compte 2 jours pour 8h → lendemain 9h (journée entamée due)", () => {
    const start = new Date("2026-07-16T08:00:00Z");
    const end = new Date("2026-07-17T09:00:00Z");
    expect(computeDurationDays(start, end)).toBe(2);
  });

  it("compte 1 jour pour exactement 24 heures", () => {
    const start = new Date("2026-07-16T08:00:00Z");
    const end = new Date("2026-07-17T08:00:00Z");
    expect(computeDurationDays(start, end)).toBe(1);
  });

  it("compte 2 jours pour 25 heures", () => {
    const start = new Date("2026-07-16T08:00:00Z");
    const end = new Date("2026-07-17T09:00:00Z");
    expect(end.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000);
    expect(computeDurationDays(start, end)).toBe(2);
  });

  it("lève une RangeError si la fin est égale au début", () => {
    const at = new Date("2026-07-16T08:00:00Z");
    expect(() => computeDurationDays(at, new Date(at))).toThrow(RangeError);
  });

  it("lève une RangeError si la fin est avant le début", () => {
    const start = new Date("2026-07-16T08:00:00Z");
    const end = new Date("2026-07-15T08:00:00Z");
    expect(() => computeDurationDays(start, end)).toThrow(RangeError);
  });
});

describe("computeBookingTotals", () => {
  it("calcule les lignes multi-matériels avec quantités", () => {
    const totals = computeBookingTotals({
      items: [
        { dailyPrice: 1000, quantity: 2 },
        { dailyPrice: 500, quantity: 1 },
      ],
      durationDays: 3,
    });
    expect(totals.durationDays).toBe(3);
    expect(totals.lineTotals).toEqual([6000, 1500]);
    expect(totals.subtotal).toBe(7500);
    expect(totals.discountAmount).toBe(0);
    expect(totals.extraFeesAmount).toBe(0);
    expect(totals.total).toBe(7500);
  });

  it("applique remise et frais : total = sous-total − remise + frais", () => {
    const totals = computeBookingTotals({
      items: [{ dailyPrice: 2000, quantity: 1 }],
      durationDays: 2,
      discountAmount: 500,
      extraFeesAmount: 250,
    });
    expect(totals.subtotal).toBe(4000);
    expect(totals.discountAmount).toBe(500);
    expect(totals.extraFeesAmount).toBe(250);
    expect(totals.total).toBe(3750);
  });

  it("ne descend jamais sous zéro quand la remise dépasse le sous-total", () => {
    const totals = computeBookingTotals({
      items: [{ dailyPrice: 100, quantity: 1 }],
      durationDays: 1,
      discountAmount: 10_000,
    });
    expect(totals.subtotal).toBe(100);
    expect(totals.total).toBe(0);
  });

  it("arrondit les lignes et le sous-total à 2 décimales (flottants)", () => {
    const totals = computeBookingTotals({
      items: [
        { dailyPrice: 0.1, quantity: 3 }, // 0.1 * 3 = 0.30000000000000004
        { dailyPrice: 0.2, quantity: 1 },
      ],
      durationDays: 1,
    });
    expect(totals.lineTotals).toEqual([0.3, 0.2]);
    expect(totals.subtotal).toBe(0.5);
    expect(totals.total).toBe(0.5);
  });

  it("normalise les entrées : durée plancher 1, quantité plancher 1, montants négatifs ignorés", () => {
    const totals = computeBookingTotals({
      items: [
        { dailyPrice: 1000, quantity: 0 }, // quantité forcée à 1
        { dailyPrice: -50, quantity: 2 }, // prix négatif forcé à 0
      ],
      durationDays: 0, // durée forcée à 1
      discountAmount: -100, // remise négative forcée à 0
      extraFeesAmount: -100, // frais négatifs forcés à 0
    });
    expect(totals.durationDays).toBe(1);
    expect(totals.lineTotals).toEqual([1000, 0]);
    expect(totals.subtotal).toBe(1000);
    expect(totals.discountAmount).toBe(0);
    expect(totals.extraFeesAmount).toBe(0);
    expect(totals.total).toBe(1000);
  });

  it("tronque une durée non entière", () => {
    const totals = computeBookingTotals({
      items: [{ dailyPrice: 100, quantity: 1 }],
      durationDays: 2.9,
    });
    expect(totals.durationDays).toBe(2);
    expect(totals.subtotal).toBe(200);
  });

  it("un forfait ne se multiplie pas par la durée", () => {
    const totals = computeBookingTotals({
      items: [
        { dailyPrice: 6390, quantity: 1 }, // location : × 3 jours
        { dailyPrice: 5000, quantity: 1, pricingMode: "flat" }, // forfait
      ],
      durationDays: 3,
    });
    expect(totals.lineTotals).toEqual([19_170, 5000]);
    expect(totals.subtotal).toBe(24_170);
  });

  it("un forfait se multiplie par la quantité (2 matelas)", () => {
    const totals = computeBookingTotals({
      items: [{ dailyPrice: 5000, quantity: 2, pricingMode: "flat" }],
      durationDays: 5,
    });
    expect(totals.lineTotals).toEqual([10_000]);
    expect(totals.total).toBe(10_000);
  });

  it("pricingMode « daily » explicite = comportement historique", () => {
    const totals = computeBookingTotals({
      items: [{ dailyPrice: 1000, quantity: 1, pricingMode: "daily" }],
      durationDays: 4,
    });
    expect(totals.subtotal).toBe(4000);
  });
});

describe("requiredMinRentalDays", () => {
  it("renvoie 1 pour une liste vide", () => {
    expect(requiredMinRentalDays([])).toBe(1);
  });

  it("renvoie la durée minimale la plus contraignante", () => {
    expect(requiredMinRentalDays([1, 3, 2])).toBe(3);
  });

  it("plafonne à 1 les valeurs nulles ou négatives", () => {
    expect(requiredMinRentalDays([0, -5])).toBe(1);
    expect(requiredMinRentalDays([0, 4, -2])).toBe(4);
  });
});
