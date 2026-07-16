import { describe, expect, it } from "vitest";

import { bookingSchema } from "@/lib/validations/booking";
import { customerSchema } from "@/lib/validations/customer";
import { equipmentSchema } from "@/lib/validations/equipment";
import { onboardingSchema } from "@/lib/validations/organization";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const EQUIPMENT_A = "22222222-2222-4222-8222-222222222222";
const EQUIPMENT_B = "33333333-3333-4333-8333-333333333333";

/** Chemins (joints par ".") des erreurs d'un safeParse en échec. */
function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  if (result.success || !result.error) return [];
  return result.error.issues.map((issue) => issue.path.join("."));
}

describe("bookingSchema", () => {
  const base = {
    customerId: CUSTOMER_ID,
    items: [{ equipmentId: EQUIPMENT_A, quantity: 2 }],
    startAt: "2026-07-16T08:00",
    endAt: "2026-07-18T08:00",
    discountAmount: 0,
    extraFeesAmount: 0,
    depositAmount: 0,
    notes: "",
    status: "draft",
  };

  it("accepte une réservation valide", () => {
    const result = bookingSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejette endAt égal à startAt", () => {
    const result = bookingSchema.safeParse({ ...base, endAt: base.startAt });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("endAt");
  });

  it("rejette endAt avant startAt", () => {
    const result = bookingSchema.safeParse({
      ...base,
      startAt: "2026-07-18T08:00",
      endAt: "2026-07-16T08:00",
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("endAt");
  });

  it("rejette un même matériel présent deux fois", () => {
    const result = bookingSchema.safeParse({
      ...base,
      items: [
        { equipmentId: EQUIPMENT_A, quantity: 1 },
        { equipmentId: EQUIPMENT_A, quantity: 2 },
      ],
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("items");
  });

  it("accepte deux matériels distincts", () => {
    const result = bookingSchema.safeParse({
      ...base,
      items: [
        { equipmentId: EQUIPMENT_A, quantity: 1 },
        { equipmentId: EQUIPMENT_B, quantity: 2 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejette une quantité de 0 sur une ligne", () => {
    const result = bookingSchema.safeParse({
      ...base,
      items: [{ equipmentId: EQUIPMENT_A, quantity: 0 }],
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("items.0.quantity");
  });

  it("rejette une liste de matériels vide", () => {
    const result = bookingSchema.safeParse({ ...base, items: [] });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("items");
  });

  it("coerce les montants et quantités transmis en chaînes", () => {
    const result = bookingSchema.safeParse({
      ...base,
      items: [{ equipmentId: EQUIPMENT_A, quantity: "3" }],
      discountAmount: "1500",
      extraFeesAmount: "250",
      depositAmount: "20000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].quantity).toBe(3);
      expect(result.data.discountAmount).toBe(1500);
      expect(result.data.extraFeesAmount).toBe(250);
      expect(result.data.depositAmount).toBe(20000);
    }
  });

  it("applique les valeurs par défaut (montants 0, statut draft)", () => {
    const result = bookingSchema.safeParse({
      customerId: CUSTOMER_ID,
      items: [{ equipmentId: EQUIPMENT_A, quantity: 1 }],
      startAt: "2026-07-16T08:00",
      endAt: "2026-07-18T08:00",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.discountAmount).toBe(0);
      expect(result.data.extraFeesAmount).toBe(0);
      expect(result.data.depositAmount).toBe(0);
      expect(result.data.status).toBe("draft");
    }
  });

  it("rejette un montant de remise négatif", () => {
    const result = bookingSchema.safeParse({ ...base, discountAmount: "-1" });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("discountAmount");
  });
});

describe("customerSchema", () => {
  it("rejette un particulier sans nom", () => {
    const result = customerSchema.safeParse({
      type: "individual",
      firstName: "Moana",
      lastName: "",
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("lastName");
  });

  it("accepte un particulier avec un nom", () => {
    const result = customerSchema.safeParse({
      type: "individual",
      lastName: "Teiki",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un professionnel sans nom de société", () => {
    const result = customerSchema.safeParse({
      type: "company",
      companyName: "",
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("companyName");
  });

  it("accepte un professionnel avec un nom de société", () => {
    const result = customerSchema.safeParse({
      type: "company",
      companyName: "Pacific Rent&Clean",
    });
    expect(result.success).toBe(true);
  });

  it("rejette une adresse email invalide", () => {
    const result = customerSchema.safeParse({
      type: "individual",
      lastName: "Teiki",
      email: "pas-un-email",
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("email");
  });
});

describe("equipmentSchema", () => {
  const base = {
    name: "Karcher HD 5/15",
    dailyPrice: 5000,
    depositAmount: 20000,
    quantityTotal: 3,
    minRentalDays: 1,
    status: "available",
  };

  it("accepte un matériel valide et coerce les nombres en chaînes", () => {
    const result = equipmentSchema.safeParse({
      ...base,
      dailyPrice: "5000",
      quantityTotal: "3",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dailyPrice).toBe(5000);
      expect(result.data.quantityTotal).toBe(3);
    }
  });

  it("rejette un prix journalier négatif", () => {
    const result = equipmentSchema.safeParse({ ...base, dailyPrice: -5 });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("dailyPrice");
  });

  it("rejette une quantité totale de 0", () => {
    const result = equipmentSchema.safeParse({ ...base, quantityTotal: 0 });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("quantityTotal");
  });

  it("rejette un nom vide", () => {
    const result = equipmentSchema.safeParse({ ...base, name: "  " });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("name");
  });
});

describe("onboardingSchema", () => {
  const base = {
    name: "Pacific Rent&Clean",
    businessType: "equipment",
    currency: "XPF",
    timezone: "Pacific/Tahiti",
    bookingPrefix: "PRC",
  };

  it("accepte une organisation valide", () => {
    const result = onboardingSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("normalise la devise en majuscules : « xpf » → XPF", () => {
    const result = onboardingSchema.safeParse({ ...base, currency: "xpf" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("XPF");
    }
  });

  it("normalise aussi le préfixe : « prc » → PRC", () => {
    const result = onboardingSchema.safeParse({ ...base, bookingPrefix: "prc" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bookingPrefix).toBe("PRC");
    }
  });

  it("rejette une devise qui n'est pas un code à 3 lettres", () => {
    for (const currency of ["FR", "FRANCS", "12X"]) {
      const result = onboardingSchema.safeParse({ ...base, currency });
      expect(result.success, `devise ${currency}`).toBe(false);
      expect(issuePaths(result)).toContain("currency");
    }
  });

  it("rejette un préfixe invalide (trop court, trop long, caractères interdits)", () => {
    for (const bookingPrefix of ["P", "ABCDEFG", "PR-C", ""]) {
      const result = onboardingSchema.safeParse({ ...base, bookingPrefix });
      expect(result.success, `préfixe « ${bookingPrefix} »`).toBe(false);
      expect(issuePaths(result)).toContain("bookingPrefix");
    }
  });

  it("rejette un fuseau horaire inconnu", () => {
    const result = onboardingSchema.safeParse({
      ...base,
      timezone: "Mars/Olympus",
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("timezone");
  });

  it("accepte un autre fuseau horaire IANA valide", () => {
    const result = onboardingSchema.safeParse({
      ...base,
      timezone: "Europe/Paris",
    });
    expect(result.success).toBe(true);
  });
});
