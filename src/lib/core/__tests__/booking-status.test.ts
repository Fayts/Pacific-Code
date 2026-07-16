import { describe, expect, it } from "vitest";

import {
  BOOKING_TRANSITIONS,
  canTransition,
  isBlockingStatus,
  isEditableStatus,
} from "@/lib/core/booking-status";
import { derivedBookingStatus } from "@/lib/core/labels";
import type { BookingStatus } from "@/lib/types/database";

const ALL_STATUSES: BookingStatus[] = [
  "draft",
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

// Matrice attendue des transitions autorisées.
const EXPECTED: Record<BookingStatus, BookingStatus[]> = {
  draft: ["pending", "confirmed", "cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

describe("BOOKING_TRANSITIONS / canTransition", () => {
  it("couvre tous les statuts", () => {
    expect(Object.keys(BOOKING_TRANSITIONS).sort()).toEqual(
      [...ALL_STATUSES].sort()
    );
  });

  it.each(ALL_STATUSES)(
    "autorise exactement les transitions attendues depuis %s",
    (from) => {
      for (const to of ALL_STATUSES) {
        expect(canTransition(from, to), `${from} → ${to}`).toBe(
          EXPECTED[from].includes(to)
        );
      }
    }
  );

  it("interdit toute transition sur soi-même", () => {
    for (const status of ALL_STATUSES) {
      expect(canTransition(status, status), `${status} → ${status}`).toBe(
        false
      );
    }
  });

  it("traite completed et cancelled comme terminaux", () => {
    expect(BOOKING_TRANSITIONS.completed).toEqual([]);
    expect(BOOKING_TRANSITIONS.cancelled).toEqual([]);
  });

  it("in_progress ne peut aller que vers completed (pas d'annulation)", () => {
    expect(BOOKING_TRANSITIONS.in_progress).toEqual(["completed"]);
    expect(canTransition("in_progress", "cancelled")).toBe(false);
  });

  it("une réservation démarrée ne peut pas revenir en arrière", () => {
    expect(canTransition("in_progress", "confirmed")).toBe(false);
    expect(canTransition("confirmed", "pending")).toBe(false);
    expect(canTransition("pending", "draft")).toBe(false);
  });
});

describe("isBlockingStatus", () => {
  it("bloque le planning pour pending, confirmed et in_progress", () => {
    expect(isBlockingStatus("pending")).toBe(true);
    expect(isBlockingStatus("confirmed")).toBe(true);
    expect(isBlockingStatus("in_progress")).toBe(true);
  });

  it("ne bloque pas pour draft, completed et cancelled", () => {
    expect(isBlockingStatus("draft")).toBe(false);
    expect(isBlockingStatus("completed")).toBe(false);
    expect(isBlockingStatus("cancelled")).toBe(false);
  });
});

describe("isEditableStatus", () => {
  it("autorise la modification pour draft, pending et confirmed", () => {
    expect(isEditableStatus("draft")).toBe(true);
    expect(isEditableStatus("pending")).toBe(true);
    expect(isEditableStatus("confirmed")).toBe(true);
  });

  it("interdit la modification pour in_progress, completed et cancelled", () => {
    expect(isEditableStatus("in_progress")).toBe(false);
    expect(isEditableStatus("completed")).toBe(false);
    expect(isEditableStatus("cancelled")).toBe(false);
  });
});

describe("derivedBookingStatus", () => {
  const now = new Date("2026-07-15T12:00:00Z");
  const pastEnd = new Date("2026-07-14T12:00:00Z");
  const futureEnd = new Date("2026-07-16T12:00:00Z");

  it("marque en retard une location en cours dont le retour est dépassé", () => {
    expect(derivedBookingStatus("in_progress", pastEnd, now)).toBe("late");
  });

  it("accepte une date de fin sous forme de chaîne", () => {
    expect(
      derivedBookingStatus("in_progress", "2026-07-14T12:00:00Z", now)
    ).toBe("late");
  });

  it("laisse in_progress quand le retour n'est pas échu", () => {
    expect(derivedBookingStatus("in_progress", futureEnd, now)).toBe(
      "in_progress"
    );
  });

  it("ne marque pas en retard une location terminée même échue", () => {
    expect(derivedBookingStatus("completed", pastEnd, now)).toBe("completed");
  });

  it("ne touche pas aux autres statuts échus", () => {
    expect(derivedBookingStatus("confirmed", pastEnd, now)).toBe("confirmed");
    expect(derivedBookingStatus("cancelled", pastEnd, now)).toBe("cancelled");
  });
});
