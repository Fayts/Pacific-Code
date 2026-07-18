import Image from "next/image";
import Link from "next/link";
import { CalendarRange, ShieldCheck, Sparkles, Waves } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: CalendarRange,
    text: "Réservations sans double-booking, calendrier en temps réel",
  },
  {
    icon: Sparkles,
    text: "Assistant IA en français, qui n'agit qu'avec votre accord",
  },
  {
    icon: ShieldCheck,
    text: "Un espace isolé et sécurisé pour chaque entreprise",
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ===== Panneau lagon (desktop) ===== */}
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Image
          src="/images/auth-lagoon.webp"
          alt="Bungalows sur pilotis dans un lagon polynésien au coucher du soleil"
          fill
          preload
          sizes="(min-width: 1024px) 45vw, 0px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#03212e]/90 via-[#03212e]/25 to-[#03212e]/40" />
        <div className="pc-tapa absolute inset-0 opacity-[0.05]" aria-hidden />

        <Link
          href="/"
          className="relative flex items-center gap-2.5 text-white"
        >
          <span className="flex size-9 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-sm">
            <Waves className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Pacific Code
          </span>
        </Link>

        <div className="relative text-white">
          <p className="pc-rise text-2xl font-semibold leading-snug xl:text-3xl">
            Votre activité de location,
            <br />
            gérée depuis le paradis.
          </p>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }, i) => (
              <li
                key={text}
                className="pc-rise flex items-center gap-3 text-sm text-white/85"
                style={{ animationDelay: `${150 + i * 120}ms` }}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm">
                  <Icon className="size-4 text-cyan-200" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ===== Colonne formulaire ===== */}
      <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[#f4f9fa] px-4 py-10 lg:min-h-0">
        {/* Décor discret : motif tapa et halos lagon/corail */}
        <div className="pc-tapa-dark absolute inset-0 opacity-[0.04]" aria-hidden />
        <div
          className="absolute -top-24 -right-24 size-80 rounded-full bg-cyan-400/15 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-24 -left-24 size-80 rounded-full bg-[#ff7a59]/10 blur-3xl"
          aria-hidden
        />

        <Link
          href="/"
          className="pc-rise relative mb-8 flex items-center gap-2.5 text-neutral-900 lg:hidden"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 via-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-600/25">
            <Waves className="size-5" aria-hidden />
          </span>
          <span className="text-xl font-semibold tracking-tight">
            Pacific Code
          </span>
        </Link>

        <div
          className="pc-rise relative w-full max-w-md"
          style={{ animationDelay: "100ms" }}
        >
          {children}
        </div>

        <p className="relative mt-8 text-xs text-neutral-500">
          Gestion de location simple et fiable — conçue en Polynésie française
        </p>
      </main>
    </div>
  );
}
