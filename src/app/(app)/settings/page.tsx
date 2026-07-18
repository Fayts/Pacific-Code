import type { Metadata } from "next";
import { SettingsClient } from "@/components/settings/settings-client";

export const metadata: Metadata = {
  title: "Paramètres",
};

// Les données viennent de la couche Repository (mock) côté client :
// cette page serveur ne porte que les métadonnées.
export default function SettingsPage() {
  return <SettingsClient />;
}
