"use client";

// Garde de session côté client (mode mock : la session vit dans le
// navigateur, pas dans un cookie serveur).

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/components/providers/app-data-provider";

export function RequireSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session, loading } = useAppData();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-neutral-50">
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span className="size-2 animate-pulse rounded-full bg-sky-600" />
          Chargement de votre espace…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
