import Link from "next/link";
import { Waves } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="relative bg-pc-abyss py-12 text-slate-300">
      <div className="pc-tapa absolute inset-x-0 top-0 h-14 opacity-[0.04]" aria-hidden />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 px-6 sm:flex-row">
        <div>
          <Link href="/" className="flex items-center gap-2.5 text-white">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-pc-lagoon to-pc-turquoise">
              <Waves className="size-4.5" aria-hidden />
            </span>
            <span className="font-semibold tracking-tight">Pacific Code</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-slate-400">
            La gestion de location simple et fiable, conçue à Tahiti pour les
            loueurs du fenua.
          </p>
        </div>
        <nav className="flex gap-10 text-sm">
          <div className="flex flex-col gap-2.5">
            <p className="font-semibold text-white">Produit</p>
            <Link href="/#parcours" className="transition hover:text-white">
              Le parcours
            </Link>
            <Link href="/#fonctionnalites" className="transition hover:text-white">
              Fonctionnalités
            </Link>
            <Link href="/#polynesie" className="transition hover:text-white">
              Pensé pour la Polynésie
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="font-semibold text-white">Compte</p>
            <Link href="/login" className="transition hover:text-white">
              Se connecter
            </Link>
            <Link href="/register" className="transition hover:text-white">
              Créer un compte
            </Link>
          </div>
        </nav>
      </div>
      <div className="mx-auto mt-10 max-w-6xl border-t border-white/10 px-6 pt-6">
        <p className="text-center text-xs text-slate-500 sm:text-left">
          © 2026 Pacific Code — Conçu à Tahiti, Polynésie française.
        </p>
      </div>
    </footer>
  );
}
