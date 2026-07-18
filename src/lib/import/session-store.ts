// Brouillons d'import : persistés dans le navigateur (mode mock), un
// brouillon actif par espace. Le brouillon est supprimé à la fin de
// l'import ou explicitement par l'utilisateur — pas de fichiers résiduels.

import type {
  ImportSessionData,
  ImportSource,
  ParsedBusiness,
} from "@/lib/types/import";
import { localId } from "@/lib/import/normalize";

const STORAGE_KEY = "pacific-code:import-session:v1";

export function emptyBusiness(): ParsedBusiness {
  return {
    name: null,
    description: null,
    phone: null,
    email: null,
    address: null,
    deliveryNotes: null,
  };
}

export function createSession(source: ImportSource): ImportSessionData {
  const now = new Date().toISOString();
  return {
    id: localId(),
    source,
    status: "draft",
    rawInput: "",
    business: emptyBusiness(),
    items: [],
    extraCategories: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

export function loadSession(): ImportSessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImportSessionData;
    if (!parsed?.id || !Array.isArray(parsed.items)) return null;
    if (!Array.isArray(parsed.extraCategories)) parsed.extraCategories = [];
    // Les imports terminés ou échoués ne sont pas repris comme brouillons.
    if (parsed.status === "completed" || parsed.status === "failed") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: ImportSessionData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...session, updatedAt: new Date().toISOString() })
    );
  } catch {
    // Stockage plein ou indisponible : le parcours reste utilisable sans brouillon.
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignoré.
  }
}
