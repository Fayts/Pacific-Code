"use client";

// Garde de session côté client (mode mock : la session vit dans le
// navigateur, pas dans un cookie serveur).

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Waves } from "lucide-react";
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
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background">
        <span className="pc-float flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-turquoise/25">
          <Waves className="size-6" aria-hidden />
        </span>
        <p className="text-sm text-muted-foreground">
          Chargement de votre espace…
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
