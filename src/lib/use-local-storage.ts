"use client";

import { useMemo, useSyncExternalStore } from "react";

const UNLOADED = Symbol("unloaded");
const subscribe = () => () => {};

/**
 * Lit une valeur JSON du localStorage (maquette : les réservations simulées
 * y sont stockées en attendant Supabase). `loaded` est faux pendant le rendu
 * serveur pour éviter d'afficher l'état vide avant l'hydratation.
 */
export function useLocalStorageJSON<T>(key: string): {
  value: T | null;
  loaded: boolean;
} {
  const raw = useSyncExternalStore<string | null | typeof UNLOADED>(
    subscribe,
    () => localStorage.getItem(key),
    () => UNLOADED
  );
  const value = useMemo(
    () => (typeof raw === "string" ? (JSON.parse(raw) as T) : null),
    [raw]
  );
  return { value, loaded: raw !== UNLOADED };
}
