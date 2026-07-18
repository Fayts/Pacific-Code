import { describe, expect, it } from "vitest";
import { MockDataProvider } from "@/lib/data/mock/provider";
import { createMemoryStorage } from "@/lib/data/mock/storage";
import {
  archiveCustomer,
  createCustomer,
  unarchiveCustomer,
  updateCustomer,
} from "@/lib/services/customer-service";
import type { CustomerInput } from "@/lib/validations/customer";

// Instant fixe : 20 juillet 2026, 10 h 00 à Tahiti (20:00 UTC).
const NOW = new Date("2026-07-20T20:00:00.000Z");

function makeProvider() {
  return new MockDataProvider({ storage: createMemoryStorage(), now: () => NOW });
}

const INDIVIDUAL: CustomerInput = {
  type: "individual",
  firstName: "Hina",
  lastName: "Teriipaia",
  companyName: "",
  email: "hina@exemple.pf",
  phone: "+689 87 11 22 33",
  address: "Punaauia, Tahiti",
  idNumber: "",
  internalNotes: "",
};

describe("customer-service", () => {
  it("crée un particulier valide et le retrouve", async () => {
    const provider = makeProvider();
    const result = await createCustomer(INDIVIDUAL, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const customer = await provider.customers.get(result.data.customerId);
    expect(customer?.last_name).toBe("Teriipaia");
    expect(customer?.email).toBe("hina@exemple.pf");
  });

  it("exige un nom pour un particulier", async () => {
    const provider = makeProvider();
    const result = await createCustomer(
      { ...INDIVIDUAL, lastName: "" },
      provider
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.lastName).toBeTruthy();
  });

  it("exige un nom de société pour un professionnel", async () => {
    const provider = makeProvider();
    const result = await createCustomer(
      { ...INDIVIDUAL, type: "company", companyName: "" },
      provider
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.companyName).toBeTruthy();
  });

  it("met à jour un client et refuse un id inconnu", async () => {
    const provider = makeProvider();
    const created = await createCustomer(INDIVIDUAL, provider);
    if (!created.ok) throw new Error("création attendue");

    const updated = await updateCustomer(
      created.data.customerId,
      { ...INDIVIDUAL, phone: "+689 87 99 88 77" },
      provider
    );
    expect(updated.ok).toBe(true);
    expect(
      (await provider.customers.get(created.data.customerId))?.phone
    ).toBe("+689 87 99 88 77");

    const missing = await updateCustomer(
      "00000000-0000-4000-8000-000000000000",
      INDIVIDUAL,
      provider
    );
    expect(missing.ok).toBe(false);
  });

  it("refuse d'archiver un client avec des réservations actives", async () => {
    const provider = makeProvider();
    // Un client du jeu de démo avec une réservation bloquante.
    const bookings = await provider.bookings.list();
    const active = bookings.find((b) =>
      ["pending", "confirmed", "in_progress"].includes(b.status)
    );
    expect(active?.customer).toBeTruthy();

    const result = await archiveCustomer(active!.customer!.id, provider);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("réservations actives");
  });

  it("archive puis restaure un client sans réservation active", async () => {
    const provider = makeProvider();
    const created = await createCustomer(INDIVIDUAL, provider);
    if (!created.ok) throw new Error("création attendue");
    const id = created.data.customerId;

    const archived = await archiveCustomer(id, provider);
    expect(archived.ok).toBe(true);
    expect((await provider.customers.list()).some((c) => c.id === id)).toBe(
      false
    );

    const restored = await unarchiveCustomer(id, provider);
    expect(restored.ok).toBe(true);
    expect((await provider.customers.list()).some((c) => c.id === id)).toBe(
      true
    );
  });
});
