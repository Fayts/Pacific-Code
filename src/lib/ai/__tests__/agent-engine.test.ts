import { describe, expect, it } from "vitest";
import { MockDataProvider } from "@/lib/data/mock/provider";
import { createMemoryStorage } from "@/lib/data/mock/storage";
import {
  CONV_COMPLAINT,
  CONV_FORM,
  CONV_JEAN,
  CONV_K5,
  CONV_PUZZI,
  EQ_K5,
  EQ_PUZZI10,
  EQ_PUZZI8,
} from "@/lib/data/mock/seed";
import {
  analyzeConversation,
  parseRequestPeriod,
  stripQuotedReply,
  type AgentAnalysis,
} from "@/lib/ai/agent-engine";
import { formatMoney } from "@/lib/core/format";

// Instant fixe : LUNDI 20 juillet 2026, 10 h 00 à Tahiti (20:00 UTC).
const NOW = new Date("2026-07-20T20:00:00.000Z");
const TZ = "Pacific/Tahiti";

function makeProvider() {
  return new MockDataProvider({ storage: createMemoryStorage(), now: () => NOW });
}

async function analyze(
  provider: MockDataProvider,
  conversationId: string
): Promise<AgentAnalysis> {
  const [organization, settings, conversation, messages] = await Promise.all([
    provider.organization.get(),
    provider.agentSettings.get(),
    provider.inbox.getConversation(conversationId),
    provider.inbox.listMessages(conversationId),
  ]);
  if (!conversation || !organization) throw new Error("données introuvables");
  return analyzeConversation(
    { conversation, messages },
    { provider, organization, settings, now: NOW }
  );
}

describe("parseRequestPeriod", () => {
  it("comprend « samedi matin jusqu'à dimanche soir »", () => {
    const period = parseRequestPeriod(
      "je voudrais louer samedi matin jusqu'à dimanche soir",
      TZ,
      NOW
    );
    expect(period?.startAt).toBe("2026-07-25T08:00");
    expect(period?.endAt).toBe("2026-07-26T18:00");
  });

  it("comprend « demain » (journée type 8 h → 17 h)", () => {
    const period = parseRequestPeriod("c'est dispo demain ?", TZ, NOW);
    expect(period?.startAt).toBe("2026-07-21T08:00");
    expect(period?.endAt).toBe("2026-07-21T17:00");
  });

  it("comprend « de mercredi à vendredi »", () => {
    const period = parseRequestPeriod("de mercredi à vendredi", TZ, NOW);
    expect(period?.startAt).toBe("2026-07-22T08:00");
    expect(period?.endAt).toBe("2026-07-24T17:00");
  });

  it("renvoie null sans expression de date", () => {
    expect(parseRequestPeriod("bonjour, avez-vous des machines ?", TZ, NOW)).toBeNull();
  });

  it("comprend « pour le 27/07/26 » (date numérique avec année)", () => {
    const period = parseRequestPeriod(
      "Réservation machine pour le 27/07/26 si possible",
      TZ,
      NOW
    );
    expect(period?.startAt).toBe("2026-07-27T08:00");
    expect(period?.endAt).toBe("2026-07-27T17:00");
  });

  it("comprend « le 27/07 » sans année (prochaine occurrence)", () => {
    const period = parseRequestPeriod("dispo le 27/07 ?", TZ, NOW);
    expect(period?.startAt).toBe("2026-07-27T08:00");
    // Date déjà passée cette année → l'année prochaine.
    const past = parseRequestPeriod("dispo le 03/01 ?", TZ, NOW);
    expect(past?.startAt).toBe("2027-01-03T08:00");
  });

  it("comprend « du 27/07 au 29/07/2026 » (plage numérique)", () => {
    const period = parseRequestPeriod(
      "je voudrais louer du 27/07 au 29/07/2026",
      TZ,
      NOW
    );
    expect(period?.startAt).toBe("2026-07-27T08:00");
    expect(period?.endAt).toBe("2026-07-29T17:00");
  });

  it("comprend la forme compacte « pour le 260726 »", () => {
    const period = parseRequestPeriod(
      "j'aimerais louer votre machine pour le 260726",
      TZ,
      NOW
    );
    expect(period?.startAt).toBe("2026-07-26T08:00");
    expect(period?.endAt).toBe("2026-07-26T17:00");
  });

  it("ne confond JAMAIS une référence de matériel avec une date", () => {
    // « Puzzi 10/1 » et « 8/1 » : pas de déclencheur devant les chiffres,
    // pas d'année → aucune date fantôme.
    expect(
      parseRequestPeriod("le Kärcher Puzzi 10/1 est-il dispo ?", TZ, NOW)
    ).toBeNull();
    expect(
      parseRequestPeriod("je préfère le Puzzi 8/1 merci", TZ, NOW)
    ).toBeNull();
  });

  it("comprend « le 27 07 26 au 28 07 26 » (séparateur espace, cas réel)", () => {
    const period = parseRequestPeriod(
      "Bonjour j'aimerais réserver votre machine puzzi 10/1 le 27 07 26 au 28 07 26. Si possi le a 08h00",
      TZ,
      NOW
    );
    expect(period?.startAt).toBe("2026-07-27T08:00");
    expect(period?.endAt).toBe("2026-07-28T17:00");
    // Le déclencheur + l'année restent exigés : deux nombres seuls ne font
    // pas une date.
    expect(parseRequestPeriod("il m'en faut le 2 3 stp", TZ, NOW)).toBeNull();
  });
});

describe("stripQuotedReply", () => {
  it("retire l'attribution Gmail (même coupée par un retour à la ligne) et les lignes citées", () => {
    const body =
      "Je vais prendre le standard svpl\r\n\r\nLe jeu. 23 juil. 2026, 10:10, Pacific Rent&Clean <pacificrentclean@gmail.com>\r\na écrit :\r\n\r\n> Bonne nouvelle, la Kärcher Puzzi 10/1 est disponible du 27/07 au 28/07.\r\n> Nous proposons deux versions.";
    expect(stripQuotedReply(body)).toBe("Je vais prendre le standard svpl");
  });

  it("conserve l'original si le message n'était qu'une citation", () => {
    const onlyQuote = "> tout le message est cité\r\n> rien d'autre";
    expect(stripQuotedReply(onlyQuote)).toBe(onlyQuote.trim());
  });
});

describe("agent-engine — analyse des conversations du seed", () => {
  it("demande Puzzi samedi→dimanche : bien choisi, dispo, prix, réponse auto-envoyable", async () => {
    const provider = makeProvider();
    const analysis = await analyze(provider, CONV_PUZZI);

    expect(analysis.intent).toBe("rental_request");
    expect(analysis.complexity).toBe("simple");
    // « Kärcher Puzzi » est ambigu : le 10/1 (2 exemplaires) est proposé,
    // le 8/1 reste listé comme alternative.
    expect(analysis.equipment?.id).toBe(EQ_PUZZI10);
    expect(analysis.candidates.some((c) => c.id === EQ_PUZZI8)).toBe(true);
    expect(analysis.period?.startAt).toBe("2026-07-25T08:00");
    expect(analysis.durationDays).toBe(2);
    expect(analysis.availability?.available).toBe(true);
    expect(analysis.pricing?.total).toBe(2 * 7990);
    expect(analysis.draftReply).toContain("Puzzi 10/1");
    expect(analysis.draftReply).toContain(formatMoney(15980, "XPF"));
    expect(analysis.draftReply).toContain("/reserver/apercu");
    // Seed : mode auto + permission d'envoi automatique.
    expect(analysis.autoSendable).toBe(true);
  });

  it("email de Jean Dupont : client reconnu, modèle exact, dispo mercredi→vendredi", async () => {
    const provider = makeProvider();
    const analysis = await analyze(provider, CONV_JEAN);

    expect(analysis.customer?.name).toBe("Jean Dupont");
    expect(analysis.equipment?.id).toBe(EQ_PUZZI10);
    expect(analysis.period?.startAt).toBe("2026-07-22T08:00");
    expect(analysis.period?.endAt).toBe("2026-07-24T17:00");
    // 1 exemplaire déjà réservé (PRC-0003), il en reste 1 sur 2.
    expect(analysis.availability?.available).toBe(true);
    expect(analysis.availability?.availableQuantity).toBe(1);
  });

  it("question prix sur le K5 en maintenance : tarif exact + indisponibilité signalée", async () => {
    const provider = makeProvider();
    const analysis = await analyze(provider, CONV_K5);

    expect(analysis.equipment?.id).toBe(EQ_K5);
    expect(analysis.availability?.reason).toBe("maintenance");
    expect(analysis.draftReply).toContain("maintenance");
    expect(analysis.draftReply).toContain(formatMoney(5990, "XPF"));
  });

  it("formulaire « machines pour canapés » : matériel incertain, précisions demandées", async () => {
    const provider = makeProvider();
    const analysis = await analyze(provider, CONV_FORM);

    expect(analysis.intent).toBe("rental_request");
    expect(analysis.equipment).toBeNull();
    expect(analysis.candidates.length).toBeGreaterThan(0);
    expect(analysis.missing.join(" ")).toContain("modèle");
    expect(analysis.missing.join(" ")).toContain("dates");
    expect(analysis.autoSendable).toBe(false);
  });

  it("réclamation : complexe, jamais auto-envoyée, transmise au responsable", async () => {
    const provider = makeProvider();
    const analysis = await analyze(provider, CONV_COMPLAINT);

    expect(analysis.intent).toBe("complaint");
    expect(analysis.complexity).toBe("complex");
    expect(analysis.autoSendable).toBe(false);
    expect(analysis.draftReply).toContain("transmis");
  });

  it("mode assisté : plus rien n'est auto-envoyable", async () => {
    const provider = makeProvider();
    await provider.agentSettings.update({ mode: "assisted" });
    const analysis = await analyze(provider, CONV_PUZZI);
    expect(analysis.autoSendable).toBe(false);
  });

  it("le ton change la rédaction (professionnel vs chaleureux)", async () => {
    const provider = makeProvider();
    await provider.agentSettings.update({ tone: "professional" });
    const professional = await analyze(provider, CONV_PUZZI);
    expect(professional.draftReply).toContain("Cordialement");
    expect(professional.draftReply).not.toContain("👋");

    await provider.agentSettings.update({ tone: "warm" });
    const warm = await analyze(provider, CONV_PUZZI);
    expect(warm.draftReply).toContain("👋");
  });
});
