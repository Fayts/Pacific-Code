// Abstraction fournisseur IA : Anthropic, OpenAI ou Google, résolue par
// variables d'environnement. Sans clé configurée, l'assistant fonctionne en
// mode démonstration (réponses déterministes, aucune dépendance externe).

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

export type ResolvedProvider =
  | { mode: "demo" }
  | { mode: "llm"; provider: string; model: LanguageModel };

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-opus-4-8",
  openai: "gpt-4o",
  google: "gemini-2.5-flash",
};

export function resolveProvider(): ResolvedProvider {
  const requested = (process.env.AI_PROVIDER ?? "").toLowerCase().trim();
  const modelId = process.env.AI_MODEL?.trim();

  const candidates: Array<{ name: string; key: string | undefined }> = [
    { name: "anthropic", key: process.env.ANTHROPIC_API_KEY },
    { name: "openai", key: process.env.OPENAI_API_KEY },
    { name: "google", key: process.env.GOOGLE_GENERATIVE_AI_API_KEY },
  ];

  // Fournisseur explicite, sinon premier fournisseur avec une clé.
  const selected =
    requested && requested !== "demo"
      ? candidates.find((c) => c.name === requested)
      : candidates.find((c) => c.key);

  if (!selected || !selected.key) {
    return { mode: "demo" };
  }

  const id = modelId || DEFAULT_MODELS[selected.name];

  switch (selected.name) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: selected.key });
      return { mode: "llm", provider: "anthropic", model: anthropic(id) };
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: selected.key });
      return { mode: "llm", provider: "openai", model: openai(id) };
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey: selected.key });
      return { mode: "llm", provider: "google", model: google(id) };
    }
    default:
      return { mode: "demo" };
  }
}
