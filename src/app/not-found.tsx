import Link from "next/link";
import { Waves } from "lucide-react";
import { MountainsBack, MountainsFront } from "@/components/landing/decor";

// 404 signée : même univers que la landing (nuit → lagon, montagnes).
export default function NotFound() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[linear-gradient(to_bottom,#04101d_0%,#071829_45%,#0b3a55_85%,#0e7f9f_100%)] px-6 text-center text-white">
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-56 text-pc-deep/80"
      >
        <MountainsBack />
      </div>
      <div
        aria-hidden
        className="absolute inset-x-0 -bottom-2 h-40 text-pc-abyss"
      >
        <MountainsFront />
      </div>

      <div className="pc-rise relative">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm">
          <Waves className="size-6" aria-hidden />
        </span>
        <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-pc-turquoise">
          Erreur 404
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Cette page a pris le large.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-white/70">
          L&apos;adresse demandée n&apos;existe pas ou plus. Revenez en eaux
          connues.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-full bg-gradient-to-r from-pc-coral to-[#ff5d54] px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-pc-coral/25 transition hover:brightness-105"
          >
            Retour au tableau de bord
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/25 bg-white/[0.07] px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/15"
          >
            Page d&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
