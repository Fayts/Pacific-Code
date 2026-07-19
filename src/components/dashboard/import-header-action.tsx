"use client";

// L'action principale du dashboard, dans le slot canonique du header
// (pattern Stripe/Linear) : pilule signature nuit→lagon, mini-médaillon,
// raccourci clavier Ctrl/⌘+I. Ouvre le parcours d'import existant.

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImportHeaderAction({ configured }: { configured: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === "i" &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey
      ) {
        const target = event.target as HTMLElement | null;
        if (target?.closest("input, textarea, [contenteditable=true]")) return;
        event.preventDefault();
        router.push("/onboarding");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <Link
      href="/onboarding"
      data-guide="import-action"
      className={cn(
        "group relative inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-pc-night via-pc-deep to-pc-lagoon py-1.5 pl-1.5 pr-4 text-sm font-semibold text-white shadow-lg shadow-pc-deep/20",
        "transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-pc-turquoise/30 hover:ring-2 hover:ring-pc-turquoise/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {/* Mini-médaillon ; halo respirant tant que l'activité n'est pas créée */}
      <span className="relative flex size-7 shrink-0">
        {!configured && (
          <span
            aria-hidden
            className="pc-breathe absolute -inset-1.5 rounded-full bg-pc-turquoise/40 blur-md"
          />
        )}
        <span className="relative flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-pc-lagoon to-pc-turquoise shadow-md shadow-pc-turquoise/30">
          <PackageOpen
            className="size-3.5 text-white transition-transform duration-300 group-hover:scale-110"
            aria-hidden
          />
        </span>
      </span>

      {configured ? "Mettre à jour" : "Créer mon activité"}

      <kbd
        className="hidden rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 font-sans text-[10px] font-medium text-white/70 sm:inline-block"
        aria-hidden
      >
        Ctrl I
      </kbd>
    </Link>
  );
}
