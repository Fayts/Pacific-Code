// Tests de l'agent d'onboarding : outils (réducteurs purs), complétude,
// passerelle vers la session d'import, et flux complet du mode
// développement (qui exerce les mêmes outils que l'agent LLM).

import { describe, expect, it } from "vitest";
import { emptyDraft, onboardingDraftSchema } from "@/lib/agent/draft";
import { AGENT_TOOLS } from "@/lib/agent/tools";
import { computeCompleteness } from "@/lib/agent/completeness";
import { applyDraftToSession } from "@/lib/agent/to-import-session";
import { runDevAgent } from "@/lib/agent/dev-agent";
import { createSession } from "@/lib/import/session-store";

describe("outils de l'agent", () => {
  it("suit le scénario du brief : Puzzi ajoutés puis tarifés puis confirmés", () => {
    let draft = emptyDraft();

    // « Deux Puzzi 10/1 et un Puzzi 8/1 »
    let applied = AGENT_TOOLS.addRentalItem.apply(draft, {
      name: "Kärcher Puzzi 10/1",
      brand: "Kärcher",
      model: "Puzzi 10/1",
      categoryName: "Matériel de nettoyage",
      quantity: 2,
    });
    draft = applied.draft;
    expect(applied.changes.map((c) => c.kind)).toEqual([
      "category",
      "item_added",
    ]);

    applied = AGENT_TOOLS.addRentalItem.apply(draft, {
      name: "Kärcher Puzzi 8/1",
      categoryName: "Matériel de nettoyage",
      quantity: 1,
    });
    draft = applied.draft;

    // La catégorie est réutilisée, pas dupliquée.
    expect(draft.categories).toHaveLength(1);
    expect(draft.items).toHaveLength(2);
    expect(draft.items[0].id).toBe("i1");
    expect(draft.items[0].quantity).toBe(2);
    expect(draft.items[0].quantityConfidence).toBe("confirmed");
    expect(draft.items[0].priceConfidence).toBe("missing");

    // « 7990 le 10/1 » — montant sans période : à vérifier.
    applied = AGENT_TOOLS.setItemPricing.apply(draft, {
      itemId: "i1",
      dailyPrice: 7990,
      confidence: "verify",
    });
    draft = applied.draft;
    expect(draft.items[0].dailyPrice).toBe(7990);
    expect(draft.items[0].priceConfidence).toBe("verify");

    // « Oui, c'est le tarif 24 h » — confirmation.
    applied = AGENT_TOOLS.resolveAmbiguity.apply(draft, {
      itemId: "i1",
      field: "price",
    });
    draft = applied.draft;
    expect(draft.items[0].priceConfidence).toBe("confirmed");

    // Le brouillon reste valide au schéma strict à chaque étape.
    expect(() => onboardingDraftSchema.parse(draft)).not.toThrow();
  });

  it("refuse un bien inconnu avec un message listant les ids", () => {
    const draft = emptyDraft();
    expect(() =>
      AGENT_TOOLS.setItemPricing.apply(draft, {
        itemId: "i9",
        dailyPrice: 1000,
        confidence: "probable",
      })
    ).toThrow(/introuvable/);
  });

  it("gère la livraison : zones dédupliquées, désactivation explicite", () => {
    let draft = emptyDraft();
    draft = AGENT_TOOLS.addDeliveryZone.apply(draft, {
      zone: "Papeete",
      free: true,
    }).draft;
    const again = AGENT_TOOLS.addDeliveryZone.apply(draft, {
      zone: "papeete",
      free: false,
      fee: 1500,
    });
    expect(again.changes).toHaveLength(0); // déjà connue
    expect(again.draft.delivery.freeZones).toEqual(["Papeete"]);
    expect(again.draft.delivery.enabled).toBe(true);

    draft = AGENT_TOOLS.updateDeliveryRules.apply(draft, {
      enabled: false,
      clearZones: true,
    }).draft;
    expect(draft.delivery.enabled).toBe(false);
    expect(draft.delivery.freeZones).toEqual([]);
  });

  it("documents : [] signifie « aucun demandé », différent de null", () => {
    const draft = emptyDraft();
    expect(draft.bookingRules.requestedDocuments).toBeNull();
    const applied = AGENT_TOOLS.updateBookingRequirements.apply(draft, {
      requestedDocuments: [],
    });
    expect(applied.draft.bookingRules.requestedDocuments).toEqual([]);
  });

  it("note les manques sans doublon", () => {
    let draft = emptyDraft();
    draft = AGENT_TOOLS.markInformationAsMissing.apply(draft, {
      topic: "Tarif du Puzzi 8/1",
    }).draft;
    const again = AGENT_TOOLS.markInformationAsMissing.apply(draft, {
      topic: "tarif du puzzi 8/1",
    });
    expect(again.draft.missing).toHaveLength(1);
  });
});

describe("complétude réelle", () => {
  it("progresse avec les données, pas avec un compteur de questions", () => {
    let draft = emptyDraft();
    expect(computeCompleteness(draft).percent).toBe(0);

    draft = AGENT_TOOLS.addRentalItem.apply(draft, {
      name: "Scooter",
      quantity: 2,
    }).draft;
    const withItem = computeCompleteness(draft);
    expect(withItem.percent).toBe(25); // catalogue seul
    expect(withItem.readyForReview).toBe(false);

    draft = AGENT_TOOLS.setItemPricing.apply(draft, {
      itemId: "i1",
      dailyPrice: 6000,
      confidence: "confirmed",
    }).draft;
    draft = AGENT_TOOLS.updateBusinessInformation.apply(draft, {
      name: "Moana Location",
    }).draft;
    // Répondre « non » complète les sections livraison / documents.
    draft = AGENT_TOOLS.updateDeliveryRules.apply(draft, {
      enabled: false,
    }).draft;
    draft = AGENT_TOOLS.updateBookingRequirements.apply(draft, {
      requestedDocuments: [],
    }).draft;
    draft = AGENT_TOOLS.setItemDeposit.apply(draft, {
      itemId: "i1",
      deposit: 0,
      confidence: "confirmed",
    }).draft;

    const done = computeCompleteness(draft);
    expect(done.percent).toBe(100);
    expect(done.readyForReview).toBe(true);
    expect(done.checklist.every((c) => c.done)).toBe(true);
  });
});

describe("passerelle vers la session d'import", () => {
  it("convertit le brouillon sans rien perdre ni inventer", () => {
    let draft = emptyDraft();
    draft = AGENT_TOOLS.updateBusinessInformation.apply(draft, {
      name: "Moana Location",
      phone: "87 12 34 56",
    }).draft;
    draft = AGENT_TOOLS.addRentalItem.apply(draft, {
      name: "Puzzi 10/1",
      brand: "Kärcher",
      categoryName: "Matériel de nettoyage",
      quantity: 2,
      dailyPrice: 7990,
      priceConfidence: "confirmed",
      options: ["suceur main"],
    }).draft;
    draft = AGENT_TOOLS.addRentalItem.apply(draft, {
      name: "Bungalow lagon",
      categoryName: "Logements",
      categoryType: "logement",
      tracking: "individual",
      weeklyPrice: 120_000,
      priceConfidence: "probable",
    }).draft;
    draft = AGENT_TOOLS.addDeliveryZone.apply(draft, {
      zone: "Papeete",
      free: true,
    }).draft;
    draft = AGENT_TOOLS.updateBookingRequirements.apply(draft, {
      requestedDocuments: ["permis", "pièce d'identité"],
      minimumDurationDays: 2,
    }).draft;

    const session = applyDraftToSession(draft, createSession("assistant"));

    expect(session.business.name).toBe("Moana Location");
    expect(session.business.deliveryNotes).toContain("Papeete");
    expect(session.business.description).toContain("permis");
    expect(session.items).toHaveLength(2);

    const puzzi = session.items[0];
    // La marque n'est pas dupliquée si déjà hors du nom : préfixée.
    expect(puzzi.name).toBe("Kärcher Puzzi 10/1");
    expect(puzzi.dailyPrice).toBe(7990);
    expect(puzzi.priceConfidence).toBe("detected");
    expect(puzzi.minRentalDays).toBe(2);
    expect(puzzi.description).toContain("suceur main");

    const bungalow = session.items[1];
    expect(bungalow.dailyPrice).toBeNull(); // jamais inventé
    // Tarif hebdo préservé en description (format fr-FR, espace insécable).
    expect(bungalow.description).toContain(
      `Tarif hebdomadaire : ${(120_000).toLocaleString("fr-FR")} XPF`
    );
    expect(bungalow.tracking).toBe("individual");
  });
});

describe("agent du mode développement (mêmes outils que l'agent réel)", () => {
  it("déroule une conversation complète jusqu'à la vérification", () => {
    let draft = emptyDraft();

    // Message vague : aucune invention, question de précision.
    let turn = runDevAgent("Je loue des Karcher.", draft);
    expect(turn.draft.items).toHaveLength(0);
    expect(turn.reply).toMatch(/quantité|louez/i);
    draft = turn.draft;

    // Catalogue en langage naturel (parseur partagé).
    turn = runDevAgent(
      "Nous proposons 3 scooters Honda PCX à 6 000 XPF par jour, 2 Toyota Yaris à 9 000 XPF par jour et un Kärcher Puzzi 10/1 à 7 990 XPF.",
      draft
    );
    expect(turn.draft.items.length).toBeGreaterThanOrEqual(2);
    expect(turn.changes.some((c) => c.kind === "item_added")).toBe(true);
    draft = turn.draft;

    // Suite du flux : nom, caution, livraison, documents.
    turn = runDevAgent("Moana Location", draft);
    expect(turn.draft.business.name).toBe("Moana Location");
    draft = turn.draft;

    turn = runDevAgent("non", draft); // caution
    expect(turn.draft.items.every((i) => i.deposit === 0)).toBe(true);
    draft = turn.draft;

    turn = runDevAgent("non", draft); // livraison
    expect(turn.draft.delivery.enabled).toBe(false);
    draft = turn.draft;

    turn = runDevAgent("permis et pièce d'identité", draft); // documents
    expect(turn.draft.bookingRules.requestedDocuments).toEqual([
      "permis",
      "pièce d'identité",
    ]);

    // Brouillon complet → vérification proposée.
    expect(turn.readyForReview).toBe(true);
    expect(computeCompleteness(turn.draft).percent).toBe(100);
  });

  it("interprète un montant seul dans le contexte du bien en attente", () => {
    let draft = emptyDraft();
    draft = AGENT_TOOLS.addRentalItem.apply(draft, {
      name: "Kärcher Puzzi 10/1",
      quantity: 2,
    }).draft;

    const turn = runDevAgent("7990", draft);
    expect(turn.draft.items[0].dailyPrice).toBe(7990);
    expect(turn.draft.items[0].priceConfidence).toBe("verify");
    expect(turn.reply).toMatch(/à confirmer/i);
  });
});
