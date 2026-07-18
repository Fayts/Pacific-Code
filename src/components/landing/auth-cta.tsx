"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";

// La session vit dans le navigateur (mode mock) : ces boutons ne peuvent
// être résolus que côté client, d'où ce composant dédié.

export function NavAuthCtas() {
  const { session, loading } = useAppData();

  if (loading) {
    return <div className="h-9 w-44 animate-pulse rounded-full bg-white/10" />;
  }

  if (session) {
    return (
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#054861] shadow-lg shadow-black/10 transition hover:bg-cyan-50"
      >
        Ouvrir le tableau de bord
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Link
        href="/login"
        className="hidden rounded-full px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white sm:block"
      >
        Se connecter
      </Link>
      <Link
        href="/register"
        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#054861] shadow-lg shadow-black/10 transition hover:bg-cyan-50 sm:px-5"
      >
        Essai gratuit
      </Link>
    </div>
  );
}

