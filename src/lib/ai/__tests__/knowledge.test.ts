import { describe, expect, it } from "vitest";
import { MockDataProvider } from "@/lib/data/mock/provider";
import { createMemoryStorage } from "@/lib/data/mock/storage";
import { matchKnowledge, rankKnowledge } from "@/lib/ai/knowledge";
import { analyzeConversation } from "@/lib/ai/agent-engine";
import type { KnowledgeEntry } from "@/lib/types/inbox";

// Instant fixe : LUNDI 20 juillet 2026, 10 h 00 à Tahiti (20:00 UTC).
const NOW = new Date("2026-07-20T20:00:00.000Z");

function entry(patch: Partial<KnowledgeEntry> & { id: string }): KnowledgeEntry {
  return {
    organization_id: "org",
    question: "Question ?",
    answer: "Réponse.",
    keywords: [],
    category: "general",
    is_active: true,
    priority: 0,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...patch,
  };
}

describe("knowledge — appariement déterministe", () => {
  it("un mot-clé retrouvé suffit à déclencher la réponse", () => {
    const entries = [
      entry({ id: "1", question: "Comment payer ?", keywords: ["paiement"] }),
    ];
    const match = matchKnowledge(
      "Bonjour, quels sont vos moyens de paiement ?",
      entries
    );
    expect(match?.entry.id).toBe("1");
    expect(match?.matched).toContain("paiement");
  });

  it("ignore les accents et les majuscules des deux côtés", () => {
    const entries = [
      entry({ id: "1", question: "Especes ?", keywords: ["espèces"] }),
    ];
    expect(matchKnowledge("Vous prenez les ESPECES ?", entries)?.entry.id).toBe(
      "1"
    );
  });

  it("reconnaît un mot-clé en plusieurs mots", () => {
    const entries = [
      entry({ id: "1", question: "Paiement ?", keywords: ["carte bancaire"] }),
    ];
    expect(
      matchKnowledge("je peux régler par carte bancaire ?", entries)?.entry.id
    ).toBe("1");
    // Les deux mots doivent se suivre : « carte » seule ne suffit pas.
    expect(matchKnowledge("j'ai perdu ma carte", entries)).toBeNull();
  });

  it("ne répond pas quand rien n'est assez sûr", () => {
    const entries = [
      entry({ id: "1", question: "Livrez-vous ?", keywords: ["livraison"] }),
    ];
    expect(
      matchKnowledge("Bonjour, comment allez-vous aujourd'hui ?", entries)
    ).toBeNull();
  });

  it("les mots vides ne déclenchent jamais une réponse", () => {
    const entries = [
      entry({
        id: "1",
        question: "Comment pouvez-vous nous aider pour cette demande ?",
        keywords: [],
      }),
    ];
    expect(matchKnowledge("Comment pouvez-vous nous aider ?", entries)).toBeNull();
  });

  it("ignore les entrées désactivées", () => {
    const entries = [
      entry({
        id: "1",
        question: "Horaires ?",
        keywords: ["horaire"],
        is_active: false,
      }),
    ];
    expect(matchKnowledge("Quels sont vos horaires ?", entries)).toBeNull();
  });

  it("la priorité départage deux entrées à égalité", () => {
    const entries = [
      entry({ id: "basse", question: "Caution ?", keywords: ["caution"] }),
      entry({
        id: "haute",
        question: "Caution ?",
        keywords: ["caution"],
        priority: 5,
      }),
    ];
    expect(matchKnowledge("C'est quoi la caution ?", entries)?.entry.id).toBe(
      "haute"
    );
  });

  it("rankKnowledge expose les alternatives, les meilleures d'abord", () => {
    const entries = [
      entry({ id: "livraison", question: "Livraison ?", keywords: ["livrez"] }),
      entry({
        id: "horaires",
        question: "Horaires ?",
        keywords: ["livrez", "samedi"],
      }),
    ];
    const ranked = rankKnowledge("Vous livrez le samedi ?", entries);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].entry.id).toBe("horaires");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});

describe("knowledge — branchement dans le moteur", () => {
  async function analyzeMessage(body: string) {
    const provider = new MockDataProvider({
      storage: createMemoryStorage(),
      now: () => NOW,
    });
    const conversation = await provider.inbox.createConversation({
      channel: "form",
      customerName: "Test",
      body,
    });
    const [organization, settings, messages] = await Promise.all([
      provider.organization.get(),
      provider.agentSettings.get(),
      provider.inbox.listMessages(conversation.id),
    ]);
    if (!organization) throw new Error("organisation introuvable");
    return analyzeConversation(
      { conversation, messages },
      { provider, organization, settings, now: NOW }
    );
  }

  it("répond à une question courante depuis la base", async () => {
    const analysis = await analyzeMessage(
      "Bonjour, est-ce que je peux payer en carte bancaire ?"
    );
    expect(analysis.intent).toBe("knowledge_question");
    expect(analysis.knowledge?.category).toBe("paiement");
    expect(analysis.draftReply).toContain("carte bancaire");
  });

  it("ne détourne pas une demande de location identifiée", async () => {
    const analysis = await analyzeMessage(
      "Je voudrais louer le Kärcher Puzzi 10/1 de mercredi à vendredi."
    );
    expect(analysis.intent).toBe("rental_request");
    expect(analysis.knowledge).toBeNull();
    expect(analysis.equipment).not.toBeNull();
  });

  it("laisse les réclamations au loueur, base ou pas", async () => {
    const analysis = await analyzeMessage(
      "La machine est en panne, je veux un remboursement — et sinon vous acceptez la carte bancaire ?"
    );
    expect(analysis.complexity).toBe("complex");
    expect(analysis.knowledge).toBeNull();
  });
});
