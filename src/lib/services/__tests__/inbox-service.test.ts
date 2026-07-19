import { describe, expect, it } from "vitest";
import { MockDataProvider } from "@/lib/data/mock/provider";
import { createMemoryStorage } from "@/lib/data/mock/storage";
import { CONV_PUZZI, CUST_JEAN } from "@/lib/data/mock/seed";
import {
  connectChannel,
  disconnectChannel,
  ignoreConversation,
  sendReply,
  simulateIncomingMessage,
  transferConversation,
  updateAgentSettings,
} from "@/lib/services/inbox-service";

// Instant fixe : 20 juillet 2026, 10 h 00 à Tahiti (20:00 UTC).
const NOW = new Date("2026-07-20T20:00:00.000Z");

function makeProvider() {
  return new MockDataProvider({ storage: createMemoryStorage(), now: () => NOW });
}

describe("inbox-service + adapter mock", () => {
  it("le seed contient canaux, conversations et messages fictifs", async () => {
    const provider = makeProvider();
    const [channels, conversations] = await Promise.all([
      provider.channels.list(),
      provider.inbox.listConversations(),
    ]);
    expect(channels).toHaveLength(3);
    expect(channels.filter((c) => c.status === "connected")).toHaveLength(2);
    expect(conversations).toHaveLength(5);
    // Triées de la plus récente à la plus ancienne.
    const times = conversations.map((c) => c.last_message_at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("répond à une conversation : message sortant + statut « répondu »", async () => {
    const provider = makeProvider();
    const result = await sendReply(
      { conversationId: CONV_PUZZI, body: "Réponse validée par le loueur", auto: false },
      provider
    );
    expect(result.ok).toBe(true);

    const messages = await provider.inbox.listMessages(CONV_PUZZI);
    const last = messages[messages.length - 1];
    expect(last.direction).toBe("outbound");
    expect(last.author).toBe("user");
    expect((await provider.inbox.getConversation(CONV_PUZZI))?.status).toBe(
      "replied"
    );
  });

  it("réponse automatique : auteur agent + statut « répondu automatiquement »", async () => {
    const provider = makeProvider();
    await sendReply(
      { conversationId: CONV_PUZZI, body: "Réponse automatique", auto: true },
      provider
    );
    const messages = await provider.inbox.listMessages(CONV_PUZZI);
    expect(messages[messages.length - 1].author).toBe("agent");
    expect((await provider.inbox.getConversation(CONV_PUZZI))?.status).toBe(
      "auto_replied"
    );
  });

  it("transfert et ignorance changent le statut ; id inconnu refusé", async () => {
    const provider = makeProvider();
    expect((await transferConversation(CONV_PUZZI, provider)).ok).toBe(true);
    expect((await provider.inbox.getConversation(CONV_PUZZI))?.status).toBe(
      "transferred"
    );
    expect((await ignoreConversation(CONV_PUZZI, provider)).ok).toBe(true);
    const missing = await transferConversation(
      "00000000-0000-4000-8000-000000000000",
      provider
    );
    expect(missing.ok).toBe(false);
  });

  it("un message entrant simulé rapproche le client par email", async () => {
    const provider = makeProvider();
    const result = await simulateIncomingMessage(
      {
        channel: "gmail",
        customerName: "Jean Dupont",
        customerContact: "jean.dupont@mail.pf",
        subject: "Nouvelle demande",
        body: "Bonjour, le Pack Auto-Home est-il libre demain ?",
      },
      provider
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const conversation = await provider.inbox.getConversation(
      result.data.conversationId
    );
    expect(conversation?.customer_id).toBe(CUST_JEAN);
    expect(conversation?.status).toBe("new");
    expect(
      await provider.inbox.listMessages(result.data.conversationId)
    ).toHaveLength(1);
  });

  it("connecte puis déconnecte WhatsApp", async () => {
    const provider = makeProvider();
    expect(
      (await connectChannel("whatsapp", "+689 87 12 34 56", provider)).ok
    ).toBe(true);
    let whatsapp = (await provider.channels.list()).find(
      (c) => c.channel === "whatsapp"
    );
    expect(whatsapp?.status).toBe("connected");
    expect(whatsapp?.display_name).toBe("+689 87 12 34 56");

    expect((await disconnectChannel("whatsapp", provider)).ok).toBe(true);
    whatsapp = (await provider.channels.list()).find(
      (c) => c.channel === "whatsapp"
    );
    expect(whatsapp?.status).toBe("disconnected");
  });

  it("met à jour les réglages de l'agent en fusionnant les permissions", async () => {
    const provider = makeProvider();
    const result = await updateAgentSettings(
      {
        mode: "assisted",
        tone: "premium",
        permissions: { auto_reply_simple: false },
      },
      provider
    );
    expect(result.ok).toBe(true);

    const settings = await provider.agentSettings.get();
    expect(settings.mode).toBe("assisted");
    expect(settings.tone).toBe("premium");
    expect(settings.permissions.auto_reply_simple).toBe(false);
    // Les autres permissions ne sont pas écrasées.
    expect(settings.permissions.check_availability).toBe(true);
  });
});
