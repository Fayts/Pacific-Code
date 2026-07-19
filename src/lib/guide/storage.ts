// Persistance de la visite guidée : un état par utilisateur, dans le
// navigateur (cohérent avec le mode mock). On mémorise uniquement que
// la visite a été vue et l'étape courante — elle reste relançable
// intégralement, à tout moment, depuis le début.

export type TourStatus = "active" | "dismissed" | "completed";

export type TourState = {
  v: 2;
  status: TourStatus;
  /** Étape courante (0-indexée ; steps.length = écran final). */
  step: number;
  startedAt: string;
  completedAt: string | null;
};

const keyFor = (userId: string) => `pacific-code:guide:v2:${userId}`;
const legacyKeyFor = (userId: string) => `pacific-code:guide:v1:${userId}`;

export function loadTourState(userId: string): TourState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as TourState;
      if (parsed?.v === 2 && typeof parsed.step === "number") return parsed;
    }
    // Migration depuis la v1 (visite à missions) : l'utilisateur a déjà
    // répondu au dialogue de bienvenue — on ne le re-propose jamais.
    if (window.localStorage.getItem(legacyKeyFor(userId))) {
      const migrated = freshTourState("dismissed");
      window.localStorage.setItem(keyFor(userId), JSON.stringify(migrated));
      window.localStorage.removeItem(legacyKeyFor(userId));
      return migrated;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveTourState(userId: string, state: TourState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(state));
  } catch {
    // Stockage indisponible : la visite fonctionne sans persistance.
  }
}

export function freshTourState(status: TourStatus): TourState {
  return {
    v: 2,
    status,
    step: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}
