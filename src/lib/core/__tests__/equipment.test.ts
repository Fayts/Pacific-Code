import { describe, expect, it } from "vitest";

import { computeEquipmentDisplay } from "@/lib/core/equipment";
import type { EquipmentItem } from "@/lib/types/database";

type ItemInput = Pick<EquipmentItem, "status" | "archived_at" | "quantity_total">;

function item(overrides: Partial<ItemInput> = {}): ItemInput {
  return {
    status: "available",
    archived_at: null,
    quantity_total: 1,
    ...overrides,
  };
}

const noLoad = { rentedNow: 0, reservedNow: 0 };

describe("computeEquipmentDisplay", () => {
  it("archivé prime sur tout le reste (même en maintenance et loué)", () => {
    const display = computeEquipmentDisplay(
      item({ status: "maintenance", archived_at: "2026-07-01T00:00:00Z" }),
      { rentedNow: 1, reservedNow: 1 }
    );
    expect(display).toEqual({ status: "archived", availableNow: 0 });
  });

  it("maintenance prime sur les réservations en cours", () => {
    const display = computeEquipmentDisplay(
      item({ status: "maintenance", quantity_total: 5 }),
      { rentedNow: 1, reservedNow: 0 }
    );
    expect(display).toEqual({ status: "maintenance", availableNow: 0 });
  });

  it("indisponible prime sur loué / réservé", () => {
    const display = computeEquipmentDisplay(
      item({ status: "unavailable", quantity_total: 5 }),
      { rentedNow: 2, reservedNow: 1 }
    );
    expect(display).toEqual({ status: "unavailable", availableNow: 0 });
  });

  it("en location quand tout est sorti", () => {
    const display = computeEquipmentDisplay(
      item({ quantity_total: 2 }),
      { rentedNow: 2, reservedNow: 0 }
    );
    expect(display).toEqual({ status: "rented", availableNow: 0 });
  });

  it("en location prime sur réservé quand plus rien n'est libre", () => {
    const display = computeEquipmentDisplay(
      item({ quantity_total: 2 }),
      { rentedNow: 1, reservedNow: 1 }
    );
    expect(display).toEqual({ status: "rented", availableNow: 0 });
  });

  it("réservé quand tout est bloqué par des réservations sans sortie", () => {
    const display = computeEquipmentDisplay(
      item({ quantity_total: 2 }),
      { rentedNow: 0, reservedNow: 2 }
    );
    expect(display).toEqual({ status: "reserved", availableNow: 0 });
  });

  it("disponible avec le compteur d'exemplaires libres", () => {
    const display = computeEquipmentDisplay(item({ quantity_total: 3 }), noLoad);
    expect(display).toEqual({ status: "available", availableNow: 3 });
  });

  it("partiellement loué reste disponible avec le bon compteur", () => {
    const display = computeEquipmentDisplay(
      item({ quantity_total: 3 }),
      { rentedNow: 1, reservedNow: 1 }
    );
    expect(display).toEqual({ status: "available", availableNow: 1 });
  });

  it("ne renvoie jamais un compteur négatif en cas de surréservation", () => {
    const display = computeEquipmentDisplay(
      item({ quantity_total: 1 }),
      { rentedNow: 2, reservedNow: 1 }
    );
    expect(display).toEqual({ status: "rented", availableNow: 0 });
  });
});
