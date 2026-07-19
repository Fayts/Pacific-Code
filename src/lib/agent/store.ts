// Persistance de la conversation d'onboarding : un état par utilisateur,
// dans le navigateur (cohérent avec le mode mock). La conversation
// reprend après fermeture de la page ; le brouillon structuré est la
// mémoire de référence — seuls les derniers messages sont renvoyés au
// modèle (voir HISTORY_LIMIT côté client).

import {
  emptyDraft,
  onboardingDraftSchema,
  type OnboardingDraft,
} from "@/lib/agent/draft";

export type AgentMessage = {
  role: "user" | "assistant";
  text: string;
  at: string;
};

export type AgentConversation = {
  v: 1;
  messages: AgentMessage[];
  draft: OnboardingDraft;
  updatedAt: string;
};

const keyFor = (userId: string) => `pacific-code:agent-onboarding:v1:${userId}`;

/** Plafond de messages conservés localement (les plus récents). */
const STORED_MESSAGES_LIMIT = 200;

export function loadConversation(userId: string): AgentConversation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgentConversation;
    if (parsed?.v !== 1 || !Array.isArray(parsed.messages)) return null;
    const draft = onboardingDraftSchema.safeParse(parsed.draft);
    if (!draft.success) return null;
    return { ...parsed, draft: draft.data };
  } catch {
    return null;
  }
}

export function saveConversation(
  userId: string,
  messages: AgentMessage[],
  draft: OnboardingDraft
) {
  if (typeof window === "undefined") return;
  try {
    const state: AgentConversation = {
      v: 1,
      messages: messages.slice(-STORED_MESSAGES_LIMIT),
      draft,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(keyFor(userId), JSON.stringify(state));
  } catch {
    // Stockage indisponible : la conversation continue sans reprise.
  }
}

export function clearConversation(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(userId));
  } catch {
    // Ignoré.
  }
}

export function freshConversation(): AgentConversation {
  return {
    v: 1,
    messages: [],
    draft: emptyDraft(),
    updatedAt: new Date().toISOString(),
  };
}
