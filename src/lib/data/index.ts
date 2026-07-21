// Point d'entrée unique de la couche de données.
// L'UI et les services n'importent QUE ce module (jamais un adapter direct).
//
// NEXT_PUBLIC_DATA_MODE :
//   - "mock" (défaut) : données fictives persistées dans le navigateur.
//   - "supabase"      : projet Supabase Cloud (auth réelle, RLS multi-tenant).

import type { DataProvider } from "@/lib/data/repositories";
import { MockDataProvider } from "@/lib/data/mock/provider";
import { SupabaseDataProvider } from "@/lib/data/supabase/provider";

let instance: DataProvider | null = null;

export function getDataProvider(): DataProvider {
  if (!instance) {
    const mode = process.env.NEXT_PUBLIC_DATA_MODE ?? "mock";
    instance =
      mode === "supabase" ? new SupabaseDataProvider() : new MockDataProvider();
  }
  return instance;
}

export type { DataProvider } from "@/lib/data/repositories";
