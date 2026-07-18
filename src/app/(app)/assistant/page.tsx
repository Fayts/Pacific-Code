import type { Metadata } from "next";
import { AssistantClient } from "@/components/assistant/assistant-client";

export const metadata: Metadata = {
  title: "Assistant IA",
};

// L'assistant tourne entièrement côté client en mode démonstration :
// cette page serveur ne porte que les métadonnées.
export default function AssistantPage() {
  return <AssistantClient />;
}
