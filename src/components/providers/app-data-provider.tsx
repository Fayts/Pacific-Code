"use client";

// Contexte de données de l'application (mode mock).
// Charge la session et l'organisation depuis le DataProvider, et déclenche
// un re-rendu à chaque mutation du store (subscribe → version).
//
// L'UI n'accède JAMAIS à une source de données directement : toujours via
// useAppData() / les services.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getDataProvider, type DataProvider } from "@/lib/data";
import type { Session } from "@/lib/data/repositories";
import type { Organization } from "@/lib/types/database";

type AppDataContextValue = {
  provider: DataProvider;
  /** Session simulée (null = déconnecté). */
  session: Session;
  organization: Organization | null;
  /** Chargement initial (lecture du stockage local). */
  loading: boolean;
  /** Incrémenté à chaque mutation des données — à mettre dans les deps des useEffect. */
  version: number;
  refresh: () => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  // Le provider est résolu une seule fois côté client.
  const [provider] = useState<DataProvider>(() => getDataProvider());
  const [session, setSession] = useState<Session>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const reload = useCallback(async () => {
    const [nextSession, nextOrganization] = await Promise.all([
      provider.auth.getSession(),
      provider.organization.get(),
    ]);
    setSession(nextSession);
    setOrganization(nextOrganization);
  }, [provider]);

  useEffect(() => {
    let cancelled = false;
    // Hydratation initiale depuis le store externe (localStorage) : les
    // setState n'interviennent qu'après résolution des promesses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload().finally(() => {
      if (!cancelled) setLoading(false);
    });
    const unsubscribe = provider.subscribe(() => {
      setVersion((v) => v + 1);
      void reload();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [provider, reload]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      provider,
      session,
      organization,
      loading,
      version,
      refresh: () => {
        setVersion((v) => v + 1);
        void reload();
      },
    }),
    [provider, session, organization, loading, version, reload]
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData doit être utilisé sous <AppDataProvider>");
  }
  return context;
}
