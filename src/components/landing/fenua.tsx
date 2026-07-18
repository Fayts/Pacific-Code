"use client";

import {
  Banknote,
  HandCoins,
  Map,
  MessageSquare,
  MousePointerClick,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { IslandsMap, WaveLines } from "@/components/landing/decor";
import { Reveal } from "@/components/landing/reveal";

const POINTS: { icon: LucideIcon; label: string }[] = [
  { icon: Banknote, label: "Tarifs en XPF" },
  { icon: HandCoins, label: "Paiements en espèces" },
  { icon: Truck, label: "Livraison et récupération" },
  { icon: Map, label: "Plusieurs zones ou îles" },
  { icon: MousePointerClick, label: "Interface simple" },
  { icon: MessageSquare, label: "Communication rapide" },
  { icon: Store, label: "Adapté aux petites structures" },
];

export function FenuaSection() {
  return (
    <section
      id="polynesie"
      className="relative scroll-mt-16 overflow-hidden bg-pc-night py-24 text-white sm:py-28"
    >
      {/* Pont depuis la section claire + texture discrète */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-pc-foam to-transparent opacity-[0.06]"
      />
      <div className="pc-tapa absolute inset-0 opacity-[0.04]" aria-hidden />
      <WaveLines className="absolute inset-x-0 top-10 h-10 text-pc-turquoise/30" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-2">
        <div>
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-pc-turquoise">
              D&apos;ici, pour ici
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Pensé pour les réalités des loueurs en Polynésie.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-white/70">
              Les logiciels venus d&apos;ailleurs ignorent le franc pacifique,
              les paiements en espèces et la vie entre plusieurs îles. Pacific
              Code part de votre quotidien, pas de celui d&apos;une agence
              parisienne.
            </p>
          </Reveal>
          <div className="mt-8 flex flex-wrap gap-2.5">
            {POINTS.map((point, i) => {
              const Icon = point.icon;
              return (
                <Reveal key={point.label} delay={0.08 + i * 0.06} y={14}>
                  <span className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
                    <Icon className="size-4 text-pc-turquoise" aria-hidden />
                    {point.label}
                  </span>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={0.3}>
            <p className="mt-6 text-sm text-white/45">
              Certaines de ces briques sont déjà en place, les autres guident
              notre feuille de route.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="relative">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-pc-lagoon/15 blur-3xl"
          />
          <IslandsMap className="relative mx-auto max-w-md lg:max-w-none" />
        </Reveal>
      </div>
    </section>
  );
}
