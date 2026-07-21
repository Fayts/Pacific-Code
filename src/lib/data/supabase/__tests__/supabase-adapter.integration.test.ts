// Test d'INTÉGRATION de l'adapter Supabase : exercé contre le vrai
// projet cloud (compte démo), du login aux réservations.
//
//   SUPABASE_INTEGRATION=1 npx vitest run supabase-adapter
//
// Ignoré par défaut : `npm test` reste hors-ligne et déterministe.
// Les données créées portent le marqueur TEST-ADAPTER (purgées ensuite).

import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { SupabaseDataProvider } from "@/lib/data/supabase/provider";
import { createBooking, changeBookingStatus } from "@/lib/services/booking-service";

const RUN = process.env.SUPABASE_INTEGRATION === "1";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://bpzoluxnpkdrkmodderi.supabase.co";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_Vya9ifYhuN_joeCG8rWz8w__dByJasd";

const MARKER = "TEST-ADAPTER";
const TIMEOUT = 30_000;

describe.skipIf(!RUN)("SupabaseDataProvider — intégration réelle", () => {
  const provider = new SupabaseDataProvider(
    createClient<Database>(URL, KEY, { auth: { persistSession: false } })
  );

  it("connecte le compte démo", { timeout: TIMEOUT }, async () => {
    const session = await provider.auth.signIn(
      "demo@pacific-rentclean.pf",
      "demo1234"
    );
    expect(session?.user.email).toBe("demo@pacific-rentclean.pf");
    expect(session?.user.firstName).toBe("Teiki");
  });

  it("refuse un mauvais mot de passe avec un message français", { timeout: TIMEOUT }, async () => {
    const bad = new SupabaseDataProvider(
      createClient<Database>(URL, KEY, { auth: { persistSession: false } })
    );
    await expect(
      bad.auth.signIn("demo@pacific-rentclean.pf", "mauvais")
    ).rejects.toThrow(/mot de passe/i);
  });

  it("lit l'organisation, le catalogue et les clients (RLS)", { timeout: TIMEOUT }, async () => {
    const org = await provider.organization.get();
    expect(org?.name).toBe("Pacific Rent&Clean");
    expect(org?.booking_prefix).toBe("PRC");

    expect(await provider.categories.list()).toHaveLength(3);
    expect(
      (await provider.equipment.list({ includeArchived: true })).length
    ).toBeGreaterThanOrEqual(4);
    expect(
      (await provider.customers.list()).length
    ).toBeGreaterThanOrEqual(3);
  });

  it("liste les réservations avec client et matériels joints", { timeout: TIMEOUT }, async () => {
    const bookings = await provider.bookings.list();
    expect(bookings.length).toBeGreaterThanOrEqual(5);
    const withItems = bookings.find((b) => b.items.length > 0);
    expect(withItems?.customer).toBeTruthy();
    expect(withItems?.items[0].equipment?.name).toBeTruthy();
  });

  it("vérifie la disponibilité via la fonction SQL", { timeout: TIMEOUT }, async () => {
    const equipment = await provider.equipment.list({ includeArchived: true });
    const puzzi10 = equipment.find((e) => e.name.includes("Puzzi 10/1"))!;
    const k5 = equipment.find((e) => e.name.includes("K5"))!;

    const free = await provider.bookings.checkAvailability({
      equipmentId: puzzi10.id,
      startAtIso: "2027-03-10T18:00:00.000Z",
      endAtIso: "2027-03-11T04:00:00.000Z",
      quantity: 1,
    });
    expect(free.available).toBe(true);
    expect(free.total_quantity).toBe(2);

    const maintenance = await provider.bookings.checkAvailability({
      equipmentId: k5.id,
      startAtIso: "2027-03-10T18:00:00.000Z",
      endAtIso: "2027-03-11T04:00:00.000Z",
      quantity: 1,
    });
    expect(maintenance.available).toBe(false);
    expect(maintenance.reason).toBe("maintenance");
  });

  it("crée une réservation réelle (service complet) puis la fait vivre", { timeout: TIMEOUT }, async () => {
    const customers = await provider.customers.list();
    const jean = customers.find((c) => c.last_name === "Dupont")!;
    const equipment = await provider.equipment.list();
    const puzzi8 = equipment.find((e) => e.name.includes("Puzzi 8/1"))!;

    const created = await createBooking(
      {
        customerId: jean.id,
        items: [{ equipmentId: puzzi8.id, quantity: 1 }],
        startAt: "2027-03-10T08:00",
        endAt: "2027-03-10T18:00",
        discountAmount: 0,
        extraFeesAmount: 0,
        depositAmount: 40000,
        notes: MARKER,
        status: "draft",
      },
      provider
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const booking = await provider.bookings.get(created.data.bookingId);
    expect(booking?.booking_number).toMatch(/^PRC-\d{4}-\d{4}$/);
    expect(booking?.total_amount).toBe(6990);
    expect(booking?.items[0].equipment?.name).toContain("Puzzi 8/1");

    // draft → pending (machine à états + revérification de disponibilité)
    const promoted = await changeBookingStatus(
      { bookingId: created.data.bookingId, status: "pending" },
      provider
    );
    expect(promoted.ok).toBe(true);

    // pending → completed est interdit par la machine à états
    const invalid = await changeBookingStatus(
      { bookingId: created.data.bookingId, status: "completed" },
      provider
    );
    expect(invalid.ok).toBe(false);

    // pending → cancelled (fin de vie propre pour la donnée de test)
    const cancelled = await changeBookingStatus(
      { bookingId: created.data.bookingId, status: "cancelled" },
      provider
    );
    expect(cancelled.ok).toBe(true);

    const history = await provider.bookings.history(created.data.bookingId);
    expect(history.map((h) => h.to_status)).toEqual([
      "draft",
      "pending",
      "cancelled",
    ]);
  });

  it("gère clients, canaux, réglages de l'agent et boîte de réception", { timeout: TIMEOUT }, async () => {
    // Client créé puis archivé/restauré
    const customer = await provider.customers.create({
      type: "individual",
      firstName: "Test",
      lastName: MARKER,
      companyName: "",
      email: "test.adapter@exemple.pf",
      phone: "",
      address: "",
      idNumber: "",
      internalNotes: MARKER,
    });
    expect(customer.id).toBeTruthy();
    expect((await provider.customers.archive(customer.id)).ok).toBe(true);
    await provider.customers.unarchive(customer.id);

    // Canal WhatsApp : connexion puis déconnexion
    await provider.channels.connect("whatsapp", "+689 87 00 00 00");
    let channels = await provider.channels.list();
    expect(
      channels.find((c) => c.channel === "whatsapp")?.status
    ).toBe("connected");
    await provider.channels.disconnect("whatsapp");
    channels = await provider.channels.list();
    expect(
      channels.find((c) => c.channel === "whatsapp")?.status
    ).toBe("disconnected");

    // Réglages de l'agent : création à la volée + mise à jour fusionnée
    const settings = await provider.agentSettings.get();
    expect(settings.mode).toBe("assisted");
    const updated = await provider.agentSettings.update({ tone: "premium" });
    expect(updated.tone).toBe("premium");
    expect(updated.permissions.check_availability).toBe(true);
    await provider.agentSettings.update({ tone: "professional" });

    // Boîte de réception : conversation entrante rapprochée par email
    const conversation = await provider.inbox.createConversation({
      channel: "gmail",
      customerName: MARKER,
      customerContact: "jean.dupont@mail.pf",
      subject: MARKER,
      body: "Bonjour, le Pack Auto-Home est-il libre demain ? (test)",
    });
    expect(conversation.customer_id).toBeTruthy();
    const message = await provider.inbox.appendMessage(conversation.id, {
      direction: "outbound",
      author: "agent",
      body: "Réponse de test (simulée).",
    });
    expect(message?.direction).toBe("outbound");
    await provider.inbox.setStatus(conversation.id, "replied");
    expect(
      (await provider.inbox.getConversation(conversation.id))?.status
    ).toBe("replied");
  });

  it("se déconnecte proprement", { timeout: TIMEOUT }, async () => {
    await provider.auth.signOut();
    expect(await provider.auth.getSession()).toBeNull();
    expect(await provider.organization.get()).toBeNull();
  });
});
