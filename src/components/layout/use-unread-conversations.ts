"use client";

// Nombre de conversations « Nouveau » dans la boîte de réception —
// alimente la pastille de la sidebar. Rafraîchi à chaque changement de
// données local (version) et toutes les 60 s (les messages arrivent côté
// serveur sans que le navigateur en soit averti).

import { useEffect, useState } from "react";
import { useAppData } from "@/components/providers/app-data-provider";

export function useUnreadConversations(): number {
  const { provider, session, version } = useAppData();
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    provider.inbox
      .listConversations()
      .then((conversations) => {
        if (cancelled) return;
        setCount(conversations.filter((c) => c.status === "new").length);
      })
      .catch(() => {
        // Silencieux : la pastille n'est jamais bloquante.
      });
    return () => {
      cancelled = true;
    };
  }, [provider, session, version, tick]);

  return session ? count : 0;
}
