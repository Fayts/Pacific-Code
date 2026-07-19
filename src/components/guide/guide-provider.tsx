"use client";

// Orchestrateur de la visite guidée. Principes :
// - proposée une seule fois, à la première connexion, jamais re-proposée ;
// - une VISITE de présentation : aucune action demandée, aucune donnée créée ;
// - relançable intégralement à tout moment (« ? » et Paramètres) ;
// - statut et étape courante mémorisés par utilisateur.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/providers/app-data-provider";
import { TOUR_STEPS, type TourStep } from "@/lib/guide/steps";
import {
  freshTourState,
  loadTourState,
  saveTourState,
  type TourState,
} from "@/lib/guide/storage";

type GuideContextValue = {
  /** null pendant le chargement ; "unseen" = jamais proposée. */
  status: TourState["status"] | "unseen" | null;
  steps: TourStep[];
  stepIndex: number;
  /** Étape courante, ou null sur l'écran final. */
  step: TourStep | null;
  isFinale: boolean;
  start: () => void;
  declineWelcome: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  finish: () => void;
  restart: () => void;
};

const GuideContext = createContext<GuideContextValue | null>(null);

export function useGuide(): GuideContextValue {
  const value = useContext(GuideContext);
  if (!value) throw new Error("useGuide doit être utilisé sous GuideProvider");
  return value;
}

export function GuideProvider({ children }: { children: ReactNode }) {
  const { session } = useAppData();
  const router = useRouter();
  const userId = session?.user.id ?? null;

  const [state, setState] = useState<TourState | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Chargement différé en microtâche : pas de setState synchrone en effet.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setState(loadTourState(userId));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const persist = useCallback(
    (next: TourState) => {
      setState(next);
      if (userId) saveTourState(userId, next);
    },
    [userId]
  );

  // Démarrage (ou relance) : la visite se joue sur le tableau de bord,
  // où toutes les cibles sont présentes.
  const begin = useCallback(() => {
    persist(freshTourState("active"));
    router.push("/dashboard");
  }, [persist, router]);

  const value = useMemo<GuideContextValue>(() => {
    const raw = state?.status === "active" ? state.step : 0;
    const stepIndex = Math.max(0, Math.min(raw, TOUR_STEPS.length));

    return {
      status: !loaded ? null : state ? state.status : "unseen",
      steps: TOUR_STEPS,
      stepIndex,
      step: stepIndex < TOUR_STEPS.length ? TOUR_STEPS[stepIndex] : null,
      isFinale: stepIndex >= TOUR_STEPS.length,
      start: begin,
      restart: begin,
      declineWelcome: () => persist(freshTourState("dismissed")),
      next: () => {
        if (state?.status === "active") {
          persist({
            ...state,
            step: Math.min(state.step + 1, TOUR_STEPS.length),
          });
        }
      },
      prev: () => {
        if (state?.status === "active") {
          persist({ ...state, step: Math.max(state.step - 1, 0) });
        }
      },
      skip: () => {
        if (state) persist({ ...state, status: "dismissed" });
      },
      finish: () => {
        if (state) {
          persist({
            ...state,
            status: "completed",
            step: 0,
            completedAt: new Date().toISOString(),
          });
        }
      },
    };
  }, [loaded, state, begin, persist]);

  return (
    <GuideContext.Provider value={value}>{children}</GuideContext.Provider>
  );
}
