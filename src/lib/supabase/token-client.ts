// Client Supabase serveur agissant AU NOM d'un utilisateur via son jeton
// d'accès (Bearer) : la RLS s'applique comme dans le navigateur.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export function createTokenClient(token: string): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

/** Client anonyme (webhooks) : n'accède qu'aux fonctions gardées par secret. */
export function createAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export function bearerToken(request: Request): string | null {
  return (
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null
  );
}

// Accès aux tables/fonctions absentes des types générés (agent, Messenger…).
// À supprimer après régénération des types Supabase.

type RawResult<T> = { data: T | null; error: { message: string } | null };

type RawClient = {
  from(table: string): ReturnType<SupabaseClient<Database>["from"]>;
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<RawResult<unknown>>;
};

export function rawTable(client: SupabaseClient<Database>, table: string) {
  return (client as unknown as RawClient).from(table);
}

export function rawRpc<T = unknown>(
  client: SupabaseClient<Database>,
  fn: string,
  args?: Record<string, unknown>
): PromiseLike<RawResult<T>> {
  return (client as unknown as RawClient).rpc(fn, args) as PromiseLike<
    RawResult<T>
  >;
}
