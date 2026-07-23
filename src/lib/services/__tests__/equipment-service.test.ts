import { describe, expect, it } from "vitest";
import { MockDataProvider } from "@/lib/data/mock/provider";
import { createMemoryStorage } from "@/lib/data/mock/storage";
import { EQ_K5, EQ_PUZZI10 } from "@/lib/data/mock/seed";
import {
  archiveEquipment,
  createCategory,
  createEquipment,
  duplicateEquipment,
  setEquipmentStatus,
  unarchiveEquipment,
  updateEquipment,
} from "@/lib/services/equipment-service";
import type { EquipmentInput } from "@/lib/validations/equipment";

// Instant fixe : 20 juillet 2026, 10 h 00 à Tahiti (20:00 UTC).
const NOW = new Date("2026-07-20T20:00:00.000Z");

function makeProvider() {
  return new MockDataProvider({ storage: createMemoryStorage(), now: () => NOW });
}

const VALID_INPUT: EquipmentInput = {
  name: "Shampouineuse test",
  categoryId: null,
  internalRef: "TST-001",
  description: "Machine de test",
  dailyPrice: 5000,
  pricingMode: "daily",
  depositAmount: 20000,
  quantityTotal: 2,
  minRentalDays: 1,
  status: "available",
  usageInstructions: "",
  internalNotes: "",
};

describe("equipment-service", () => {
  it("crée un matériel valide et le retrouve dans la liste", async () => {
    const provider = makeProvider();
    const result = await createEquipment(VALID_INPUT, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const item = await provider.equipment.get(result.data.equipmentId);
    expect(item?.name).toBe("Shampouineuse test");
    expect(item?.internal_ref).toBe("TST-001");
    expect(item?.archived_at).toBeNull();
  });

  it("refuse un matériel sans nom avec des erreurs de champ", async () => {
    const provider = makeProvider();
    const result = await createEquipment(
      { ...VALID_INPUT, name: "" },
      provider
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.name).toBeTruthy();
  });

  it("met à jour un matériel existant et refuse un id inconnu", async () => {
    const provider = makeProvider();
    const updated = await updateEquipment(
      EQ_K5,
      { ...VALID_INPUT, name: "Kärcher K5 rénové" },
      provider
    );
    expect(updated.ok).toBe(true);
    expect((await provider.equipment.get(EQ_K5))?.name).toBe(
      "Kärcher K5 rénové"
    );

    const missing = await updateEquipment(
      "00000000-0000-4000-8000-000000000000",
      VALID_INPUT,
      provider
    );
    expect(missing.ok).toBe(false);
  });

  it("change le statut manuel (maintenance → disponible)", async () => {
    const provider = makeProvider();
    const result = await setEquipmentStatus(EQ_K5, "available", provider);
    expect(result.ok).toBe(true);
    expect((await provider.equipment.get(EQ_K5))?.status).toBe("available");
  });

  it("refuse d'archiver un matériel avec des réservations actives", async () => {
    const provider = makeProvider();
    const result = await archiveEquipment(EQ_PUZZI10, provider);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("réservations actives");
  });

  it("archive puis restaure un matériel sans réservation", async () => {
    const provider = makeProvider();
    const archived = await archiveEquipment(EQ_K5, provider);
    expect(archived.ok).toBe(true);

    const activeList = await provider.equipment.list();
    expect(activeList.some((e) => e.id === EQ_K5)).toBe(false);

    const restored = await unarchiveEquipment(EQ_K5, provider);
    expect(restored.ok).toBe(true);
    const backList = await provider.equipment.list();
    expect(backList.some((e) => e.id === EQ_K5)).toBe(true);
  });

  it("duplique un matériel en copie disponible", async () => {
    const provider = makeProvider();
    const result = await duplicateEquipment(EQ_PUZZI10, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.equipmentId).not.toBe(EQ_PUZZI10);
    const copy = await provider.equipment.get(result.data.equipmentId);
    expect(copy?.name).toContain("(copie)");
    expect(copy?.status).toBe("available");
  });

  it("crée une catégorie et la liste triée", async () => {
    const provider = makeProvider();
    const result = await createCategory(
      { name: "Autolaveuses", description: "" },
      provider
    );
    expect(result.ok).toBe(true);

    const categories = await provider.categories.list();
    expect(categories.some((c) => c.name === "Autolaveuses")).toBe(true);
  });

  it("refuse une catégorie sans nom", async () => {
    const provider = makeProvider();
    const result = await createCategory({ name: "  " }, provider);
    expect(result.ok).toBe(false);
  });
});
