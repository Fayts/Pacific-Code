import type { Metadata } from "next";
import { ConnectionsClient } from "@/components/agent-settings/connections-client";

export const metadata: Metadata = {
  title: "Agent IA — Connexions",
};

// Les données viennent de la couche Repository (mock) côté client :
// cette page serveur ne porte que les métadonnées.
export default function AgentConnectionsPage() {
  return <ConnectionsClient />;
}
