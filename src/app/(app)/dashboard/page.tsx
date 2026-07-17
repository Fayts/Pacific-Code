import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata: Metadata = {
  title: "Tableau de bord",
};

// Les données viennent de la couche Repository (mock) côté client :
// cette page serveur ne fait que porter les métadonnées.
export default function DashboardPage() {
  return <DashboardClient />;
}
