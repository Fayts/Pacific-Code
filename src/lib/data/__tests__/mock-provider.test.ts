import { beforeEach, describe, expect, it } from "vitest";
import { MockDataProvider } from "@/lib/data/mock/provider";
import { createMemoryStorage } from "@/lib/data/mock/storage";
import { EQ_K5, EQ_PUZZI8, EQ_PUZZI10, CUST_JEAN } from "@/lib/data/mock/seed";
import {
  changeBookingStatus,
  checkBookingAvailability,
  createBooking,
} from "@/lib/services/booking-service";

// Instant fixe : 20 juillet 2026, 10 h 00 à Tahiti (20:00 UTC).
const NOW = new Date("2026-07-20T20:00:00.000Z");
const YEAR = NOW.getFullYear();

function makeProvider(storage = createMemoryStorage()) {
  return new MockDataProvider({ storage, now: () => NOW });
}

// Période libre pour tous les matériels (aucune réservation du seed).
const FREE_START = "2026-08-10T08:00";
const FREE_END = "2026-08-10T18:00";

function bookingInput(overrides: Record<string, unknown> = {}) {
  return {
    customerId: CUST_JEAN,
    items: [{ equipmentId: EQ_PUZZI8, quantity: 1 }],
    startAt: FREE_START,
    endAt: FREE_END,
    discountAmount: 0,
    extraFeesAmount: 0,
    depositAmount: 40000,
    notes: "",
    status: "confirmed",
    ...overrides,
  };
}

describe("MockDataProvider — seed et persistance", () => {
  it("charge le jeu de données fictif Pacific Rent&Clean", async () => {
    const provider = makeProvider();
    expect((await provider.equipment.list({ includeArchived: true })).length).toBe(6);
    expect((await provider.customers.list()).length).toBe(3);
    expect((await provider.bookings.list()).length).toBe(5);
    expect((await provider.organization.get())!.name).toBe("Pacific Rent&Clean");
    expect((await provider.organization.get())!.booking_prefix).toBe("PRC");
  });

  it("persiste dans le stockage : un second provider relit les mêmes données", async () => {
    const storage = createMemoryStorage();
    const first = makeProvider(storage);
    await first.customers.create({
      type: "individual",
      firstName: "Tama",
      lastName: "Teiva",
      companyName: "",
      email: "",
      phone: "",
      address: "",
      idNumber: "",
      internalNotes: "",
    });
    const second = makeProvider(storage);
    expect((await second.customers.list()).length).toBe(4);
  });

  it("resetDemoData restaure le seed mais conserve la session", async () => {
    const provider = makeProvider();
    await provider.auth.signIn("test@exemple.pf", "x");
    await provider.equipment.create({
      name: "Test",
      categoryId: null,
      internalRef: "",
      description: "",
      dailyPrice: 1000,
      pricingMode: "daily",
      depositAmount: 0,
      quantityTotal: 1,
      minRentalDays: 1,
      status: "available",
      usageInstructions: "",
      internalNotes: "",
    });
    await provider.resetDemoData();
    expect((await provider.equipment.list({ includeArchived: true })).length).toBe(6);
    expect(await provider.auth.getSession()).not.toBeNull();
  });
});

describe("MockDataProvider — accessoires liés", () => {
  it("le seed lie les pastilles aux deux Puzzi", async () => {
    const provider = makeProvider();
    const addons10 = await provider.equipment.listAddons(EQ_PUZZI10);
    const addons8 = await provider.equipment.listAddons(EQ_PUZZI8);
    expect(addons10.map((a) => a.name)).toContain(
      "Pastilles détergentes RM 760 (lot de 2)"
    );
    expect(addons8).toHaveLength(1);
    expect(addons8[0].pricing_mode).toBe("flat");
  });

  it("setAddons remplace l'ensemble, refuse l'auto-lien, et persiste", async () => {
    const storage = createMemoryStorage();
    const provider = makeProvider(storage);
    await provider.equipment.setAddons(EQ_K5, [EQ_PUZZI8, EQ_K5, "inconnu"]);
    const addons = await provider.equipment.listAddons(EQ_K5);
    expect(addons.map((a) => a.id)).toEqual([EQ_PUZZI8]);

    await provider.equipment.setAddons(EQ_K5, []);
    expect(await provider.equipment.listAddons(EQ_K5)).toHaveLength(0);

    const links = await makeProvider(storage).equipment.listAddonLinks();
    expect(links.some((l) => l.equipment_id === EQ_K5)).toBe(false);
    expect(links.filter((l) => l.addon_id !== "").length).toBeGreaterThan(0);
  });
});

describe("MockDataProvider — authentification simulée", () => {
  it("signIn accepte n'importe quel email et crée la session", async () => {
    const provider = makeProvider();
    const session = await provider.auth.signIn("hina@exemple.pf", "peu-importe");
    expect(session?.user.email).toBe("hina@exemple.pf");
    expect((await provider.auth.getSession())?.user.email).toBe("hina@exemple.pf");
    await provider.auth.signOut();
    expect(await provider.auth.getSession()).toBeNull();
  });

  it("signUp renomme l'entreprise de démonstration", async () => {
    const provider = makeProvider();
    await provider.auth.signUp({
      email: "moi@boite.pf",
      password: "peu-importe",
      firstName: "Heiva",
      lastName: "Nui",
      companyName: "Tahiti Loc",
      businessType: "vehicles",
    });
    const org = await provider.organization.get();
    expect(org!.name).toBe("Tahiti Loc");
    expect(org!.business_type).toBe("vehicles");
  });
});

describe("MockDataProvider — disponibilité", () => {
  it("détecte le conflit avec une réservation bloquante du seed (Puzzi 8/1, à confirmer)", async () => {
    const provider = makeProvider();
    // B4 (pending) occupe le Puzzi 8/1 dans ~5 jours pendant 10 h.
    const b4 = (await provider.bookings.list()).find(
      (b) => b.booking_number === `PRC-${YEAR}-0004`
    )!;
    const result = await provider.bookings.checkAvailability({
      equipmentId: EQ_PUZZI8,
      startAtIso: b4.start_at,
      endAtIso: b4.end_at,
      quantity: 1,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe("conflict");
    expect(result.conflicts[0]?.booking_number).toBe(`PRC-${YEAR}-0004`);
  });

  it("gère les quantités : le Puzzi 10/1 (2 exemplaires) reste disponible pour 1 unité pendant B3", async () => {
    const provider = makeProvider();
    const b3 = (await provider.bookings.list()).find(
      (b) => b.booking_number === `PRC-${YEAR}-0003`
    )!;
    const forOne = await provider.bookings.checkAvailability({
      equipmentId: EQ_PUZZI10,
      startAtIso: b3.start_at,
      endAtIso: b3.end_at,
      quantity: 1,
    });
    expect(forOne.available).toBe(true);
    expect(forOne.available_quantity).toBe(1);

    const forTwo = await provider.bookings.checkAvailability({
      equipmentId: EQ_PUZZI10,
      startAtIso: b3.start_at,
      endAtIso: b3.end_at,
      quantity: 2,
    });
    expect(forTwo.available).toBe(false);
  });

  it("un matériel en maintenance est indisponible", async () => {
    const provider = makeProvider();
    const result = await provider.bookings.checkAvailability({
      equipmentId: EQ_K5,
      startAtIso: "2026-09-01T00:00:00.000Z",
      endAtIso: "2026-09-02T00:00:00.000Z",
      quantity: 1,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe("maintenance");
  });
});

describe("Service Réservations (sur mock)", () => {
  let provider: MockDataProvider;
  beforeEach(() => {
    provider = makeProvider();
  });

  it("crée une réservation confirmée : numéro PRC-…-0006, prix recalculé", async () => {
    const result = await createBooking(bookingInput(), provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const booking = await provider.bookings.get(result.data.bookingId);
    expect(booking?.booking_number).toBe(`PRC-${YEAR}-0006`);
    expect(booking?.status).toBe("confirmed");
    expect(booking?.duration_days).toBe(1);
    expect(booking?.subtotal).toBe(6990);
    expect(booking?.total_amount).toBe(6990);
    expect(booking?.items[0]?.equipment?.name).toBe("Kärcher Puzzi 8/1");
  });

  it("refuse la double réservation (même matériel, même période)", async () => {
    const first = await createBooking(bookingInput(), provider);
    expect(first.ok).toBe(true);
    const second = await createBooking(bookingInput(), provider);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("déjà réservé");
    }
  });

  it("tolère le conflit pour un brouillon, mais bloque sa confirmation ensuite", async () => {
    await createBooking(bookingInput(), provider);
    const draft = await createBooking(bookingInput({ status: "draft" }), provider);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const promote = await changeBookingStatus(
      { bookingId: draft.data.bookingId, status: "confirmed" },
      provider
    );
    expect(promote.ok).toBe(false);
  });

  it("applique la machine à états (terminée = statut final)", async () => {
    const done = (await provider.bookings.list()).find(
      (b) => b.status === "completed"
    )!;
    const result = await changeBookingStatus(
      { bookingId: done.id, status: "in_progress" },
      provider
    );
    expect(result.ok).toBe(false);
  });

  it("checkBookingAvailability renvoie le détail par matériel", async () => {
    await createBooking(bookingInput(), provider);
    const result = await checkBookingAvailability(
      {
        items: [
          { equipmentId: EQ_PUZZI8, quantity: 1 },
          { equipmentId: EQ_PUZZI10, quantity: 1 },
        ],
        startAt: FREE_START,
        endAt: FREE_END,
      },
      provider
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.allAvailable).toBe(false);
    const puzzi8 = result.data.items.find((i) => i.equipmentId === EQ_PUZZI8);
    const puzzi10 = result.data.items.find((i) => i.equipmentId === EQ_PUZZI10);
    expect(puzzi8?.available).toBe(false);
    expect(puzzi10?.available).toBe(true);
  });

  it("refuse l'archivage d'un matériel avec réservation active, l'autorise sinon", async () => {
    const blocked = await provider.equipment.archive(EQ_PUZZI10);
    expect(blocked.ok).toBe(false);
    const allowed = await provider.equipment.archive(EQ_K5);
    expect(allowed.ok).toBe(true);
  });
});
