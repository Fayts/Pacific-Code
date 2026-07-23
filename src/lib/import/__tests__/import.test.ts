import { describe, expect, it } from "vitest";
import { parsePrice, parseQuantity, normalizeName, individualName } from "@/lib/import/normalize";
import { autoMapColumns, parseCsv, rowsToItems } from "@/lib/import/csv";
import { parseCatalogText } from "@/lib/import/text-parser";
import { internalDuplicateIds, markDuplicates } from "@/lib/import/duplicates";
import { computeItemIssues, itemReviewState } from "@/lib/import/issues";
import { runImport } from "@/lib/import/import-runner";
import { createSession } from "@/lib/import/session-store";
import type { ParsedItem } from "@/lib/types/import";
import type { DataProvider } from "@/lib/data/repositories";
import type { EquipmentCategory, EquipmentItem } from "@/lib/types/database";

// ------------------------------------------------------------
// Normalisation
// ------------------------------------------------------------

describe("parsePrice", () => {
  it("lit les formats XPF courants", () => {
    expect(parsePrice("7 990 XPF")).toBe(7990);
    expect(parsePrice("7.990 F CFP")).toBe(7990);
    expect(parsePrice("6000")).toBe(6000);
    expect(parsePrice("20 000 xpf")).toBe(20000);
  });
  it("refuse l'illisible et le négatif", () => {
    expect(parsePrice("gratuit")).toBeNull();
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("-500")).toBeNull();
  });
});

describe("parseQuantity / noms", () => {
  it("chiffres et mots", () => {
    expect(parseQuantity("3")).toBe(3);
    expect(parseQuantity("trois")).toBe(3);
    expect(parseQuantity("x12")).toBe(12);
    expect(parseQuantity("zéro idée")).toBeNull();
  });
  it("normalise et numérote", () => {
    expect(normalizeName("Kärcher Puzzi 10/1")).toBe("karcher puzzi 10 1");
    expect(individualName("Honda PCX", 2, 5)).toBe("Honda PCX 02");
    expect(individualName("Bus", 3, 120)).toBe("Bus 003");
  });
});

// ------------------------------------------------------------
// CSV
// ------------------------------------------------------------

describe("parseCsv + mapping", () => {
  const csv = [
    'Nom;Catégorie;Quantité;Prix journalier (XPF);Caution (XPF)',
    'Kärcher Puzzi 10/1;Matériel;1;7990;20000',
    '"Scooter; Honda PCX";Scooters;3;6000;',
  ].join("\r\n");

  it("détecte séparateur, en-têtes et guillemets", () => {
    const table = parseCsv(csv);
    expect(table.delimiter).toBe(";");
    expect(table.headers).toHaveLength(5);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1][0]).toBe("Scooter; Honda PCX");
  });

  it("associe automatiquement les colonnes puis produit des lignes", () => {
    const table = parseCsv(csv);
    const mapping = autoMapColumns(table.headers);
    expect(mapping[0]).toBe("name");
    expect(mapping[1]).toBe("category");
    expect(mapping[2]).toBe("quantity");
    expect(mapping[3]).toBe("dailyPrice");
    expect(mapping[4]).toBe("depositAmount");

    const items = rowsToItems(table, mapping);
    expect(items[0].name).toBe("Kärcher Puzzi 10/1");
    expect(items[0].dailyPrice).toBe(7990);
    expect(items[0].depositAmount).toBe(20000);
    expect(items[0].pricingMode).toBe("daily");
    expect(items[1].quantity).toBe(3);
    expect(items[1].dailyPrice).toBe(6000);
    expect(items[1].depositAmount).toBeNull();
    expect(items[1].priceConfidence).toBe("detected");
    expect(items[1].depositConfidence).toBe("missing");
  });

  it("associe la colonne Tarification sans absorber le prix, et lit « forfait »", () => {
    const csvWithMode = [
      "Nom;Prix (XPF);Tarification (jour ou forfait)",
      "Kärcher Puzzi 10/1;7990;jour",
      "Nettoyage matelas;5000;forfait",
      "Nettoyage canapé;8000;Prestation au forfait",
    ].join("\r\n");
    const table = parseCsv(csvWithMode);
    const mapping = autoMapColumns(table.headers);
    expect(mapping).toEqual(["name", "dailyPrice", "pricingMode"]);

    const items = rowsToItems(table, mapping);
    expect(items[0].pricingMode).toBe("daily");
    expect(items[1].pricingMode).toBe("flat");
    expect(items[2].pricingMode).toBe("flat");
    expect(items[1].dailyPrice).toBe(5000);
  });
});

// ------------------------------------------------------------
// Texte / annonces
// ------------------------------------------------------------

describe("parseCatalogText", () => {
  it("analyse l'exemple de démonstration complet", () => {
    const result = parseCatalogText(
      "Nous proposons 3 scooters Honda PCX à 6 000 XPF par jour, 2 Toyota Yaris à 9 000 XPF par jour et un Kärcher Puzzi 10/1 à 7 990 XPF. Une caution de 20 000 XPF est demandée pour le matériel. La livraison est gratuite entre Papenoo et Papeete."
    );
    expect(result.items).toHaveLength(3);

    const [scooter, yaris, puzzi] = result.items;
    expect(scooter.quantity).toBe(3);
    expect(scooter.dailyPrice).toBe(6000);
    expect(scooter.categoryName).toBe("Scooters");
    expect(scooter.tracking).toBe("individual");

    expect(yaris.quantity).toBe(2);
    expect(yaris.dailyPrice).toBe(9000);

    expect(puzzi.dailyPrice).toBe(7990);
    expect(puzzi.categoryName).toBe("Matériel");
    expect(puzzi.tracking).toBe("stock");

    // Caution globale répartie en « probable » — jamais silencieusement sûre.
    expect(result.appliedGlobalDeposit).toBe(true);
    expect(puzzi.depositAmount).toBe(20000);
    expect(puzzi.depositConfidence).toBe("probable");

    expect(result.business.deliveryNotes).toMatch(/livraison/i);
  });

  it("ne détecte rien dans un texte sans prix", () => {
    const result = parseCatalogText("Bonjour, nous sommes une entreprise familiale.");
    expect(result.items).toHaveLength(0);
  });
});

// ------------------------------------------------------------
// Doublons + problèmes
// ------------------------------------------------------------

function fakeItem(patch: Partial<ParsedItem>): ParsedItem {
  return {
    id: Math.random().toString(36).slice(2),
    name: "Bien",
    categoryName: "Matériel",
    tracking: "stock",
    quantity: 1,
    dailyPrice: 1000,
    pricingMode: "daily",
    depositAmount: null,
    minRentalDays: 1,
    internalRef: "",
    description: "",
    internalNotes: "",
    priceConfidence: "detected",
    depositConfidence: "missing",
    duplicateOfId: null,
    duplicateOfName: null,
    duplicateResolution: "create",
    excluded: false,
    ...patch,
  };
}

describe("doublons", () => {
  it("détecte contre l'existant (nom normalisé)", () => {
    const existing = [
      { id: "eq1", name: "Kärcher Puzzi 10/1", internal_ref: null, archived_at: null },
    ] as unknown as EquipmentItem[];
    const [marked] = markDuplicates(
      [fakeItem({ name: "karcher puzzi 10/1" })],
      existing
    );
    expect(marked.duplicateOfId).toBe("eq1");
    expect(marked.duplicateOfName).toBe("Kärcher Puzzi 10/1");
  });

  it("détecte les doublons internes à l'import", () => {
    const a = fakeItem({ name: "Paddle" });
    const b = fakeItem({ name: "paddle" });
    const dupes = internalDuplicateIds([a, b]);
    expect(dupes.has(a.id)).toBe(true);
    expect(dupes.has(b.id)).toBe(true);
  });
});

describe("issues", () => {
  it("classe les états de revue", () => {
    const ready = fakeItem({});
    expect(itemReviewState(ready, computeItemIssues(ready, new Set()))).toBe("ready");

    const noPrice = fakeItem({ dailyPrice: null, priceConfidence: "missing" });
    expect(itemReviewState(noPrice, computeItemIssues(noPrice, new Set()))).toBe("incomplete");

    const noName = fakeItem({ name: " " });
    expect(itemReviewState(noName, computeItemIssues(noName, new Set()))).toBe("error");
  });
});

// ------------------------------------------------------------
// Import final (provider factice en mémoire)
// ------------------------------------------------------------

function fakeProvider(options?: { failOnCreate?: number }) {
  const categories: EquipmentCategory[] = [];
  const equipment: EquipmentItem[] = [];
  const archived: string[] = [];
  const removedCategories: string[] = [];
  let orgPatch: Record<string, unknown> | null = null;
  let creations = 0;

  const provider = {
    categories: {
      list: async () => categories,
      create: async (name: string) => {
        const cat = { id: `cat_${categories.length + 1}`, name } as EquipmentCategory;
        categories.push(cat);
        return cat;
      },
      remove: async (id: string) => {
        removedCategories.push(id);
      },
    },
    equipment: {
      create: async (draft: { name: string; quantityTotal: number }) => {
        creations += 1;
        if (options?.failOnCreate === creations) {
          throw new Error("panne simulée");
        }
        const item = {
          id: `eq_${creations}`,
          name: draft.name,
          quantity_total: draft.quantityTotal,
          archived_at: null,
        } as unknown as EquipmentItem;
        equipment.push(item);
        return item;
      },
      update: async () => equipment[0] ?? null,
      archive: async (id: string) => {
        archived.push(id);
        return { ok: true };
      },
    },
    organization: {
      update: async (patch: Record<string, unknown>) => {
        orgPatch = patch;
        return patch;
      },
    },
  } as unknown as DataProvider;

  return {
    provider,
    inspect: () => ({ categories, equipment, archived, removedCategories, orgPatch }),
  };
}

describe("runImport", () => {
  it("crée catégories et biens, numérote les individualisés, clôt l'onboarding", async () => {
    const { provider, inspect } = fakeProvider();
    const session = createSession("text");
    session.business.name = "Pacific Rent & Clean";
    session.items = [
      fakeItem({ name: "Honda PCX", categoryName: "Scooters", quantity: 3, tracking: "individual", dailyPrice: 6000 }),
      fakeItem({ name: "Chaise pliante", categoryName: "Événementiel", quantity: 50, tracking: "stock", dailyPrice: 300 }),
    ];

    const result = await runImport(session, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.createdCategories).toBe(2);
    expect(result.data.createdItems).toBe(4); // 3 fiches PCX + 1 stock

    const state = inspect();
    expect(state.equipment.map((e) => e.name)).toEqual([
      "Honda PCX 01",
      "Honda PCX 02",
      "Honda PCX 03",
      "Chaise pliante",
    ]);
    expect(state.orgPatch).toMatchObject({ name: "Pacific Rent & Clean" });
    expect(state.orgPatch).toHaveProperty("onboarding_completed_at");
  });

  it("refuse un import invalide avant toute écriture", async () => {
    const { provider, inspect } = fakeProvider();
    const session = createSession("text");
    session.items = [fakeItem({ name: "" })];

    const result = await runImport(session, provider);
    expect(result.ok).toBe(false);
    expect(inspect().equipment).toHaveLength(0);
    expect(inspect().categories).toHaveLength(0);
  });

  it("annule (rollback) en cas de panne à mi-chemin", async () => {
    const { provider, inspect } = fakeProvider({ failOnCreate: 2 });
    const session = createSession("text");
    session.items = [
      fakeItem({ name: "Puzzi 10/1", categoryName: "Matériel" }),
      fakeItem({ name: "Puzzi 8/1", categoryName: "Matériel" }),
    ];

    const result = await runImport(session, provider);
    expect(result.ok).toBe(false);
    const state = inspect();
    // Le bien créé avant la panne a été archivé, la catégorie retirée.
    expect(state.archived).toEqual(["eq_1"]);
    expect(state.removedCategories).toHaveLength(1);
  });

  it("ignore les lignes exclues et respecte « skip » des doublons", async () => {
    const { provider, inspect } = fakeProvider();
    const session = createSession("text");
    session.items = [
      fakeItem({ name: "Gardé" }),
      fakeItem({ name: "Exclu", excluded: true }),
      fakeItem({ name: "Doublon", duplicateOfId: "x", duplicateResolution: "skip" }),
    ];

    const result = await runImport(session, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.createdItems).toBe(1);
    expect(result.data.skippedItems).toBe(2);
    expect(inspect().equipment.map((e) => e.name)).toEqual(["Gardé"]);
  });
});
