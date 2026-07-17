// Point d'entrée unique de la couche de données.
// L'UI et les services n'importent QUE ce module (jamais un adapter direct).
//
// Mode actuel : "mock" — données fictives persistées dans le navigateur.
// Plus tard : NEXT_PUBLIC_DATA_MODE=supabase basculera sur l'adapter
// Supabase Cloud sans modifier ni l'UI ni les services.

import type { DataProvider } from "@/lib/data/repositories";
import { MockDataProvider } from "@/lib/data/mock/provider";

let instance: DataProvider | null = null;

export function getDataProvider(): DataProvider {
  if (!instance) {
    const mode = process.env.NEXT_PUBLIC_DATA_MODE ?? "mock";
    if (mode === "supabase") {
      // Adapter Supabase à implémenter lors du branchement cloud (post-MVP).
      throw new Error(
        "NEXT_PUBLIC_DATA_MODE=supabase : adapter non implémenté — utilisez le mode mock."
      );
    }
    instance = new MockDataProvider();
  }
  return instance;
}

export type { DataProvider } from "@/lib/data/repositories";
