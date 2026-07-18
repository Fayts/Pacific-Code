"use client";

import {
  CalendarRange,
  Check,
  FileText,
  Package,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Reveal, SectionHeading, EASE } from "@/components/landing/reveal";

function FeatureCard({
  icon: Icon,
  title,
  description,
  className,
  delay = 0,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <Reveal
      delay={delay}
      className={cn(
        "group flex flex-col rounded-2xl border border-pc-lagoon/10 bg-white p-6 shadow-sm shadow-pc-deep/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-pc-deep/10",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-lagoon/25">
          <Icon className="size-5" aria-hidden />
        </span>
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        {description}
      </p>
      <div className="mt-5 flex-1">{children}</div>
    </Reveal>
  );
}

const inView = { once: true, margin: "-15% 0px" } as const;

export function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="scroll-mt-16 bg-pc-foam px-6 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Fonctionnalités"
          title="L'essentiel, sans usine à gaz"
          lead="Cinq briques simples qui couvrent le quotidien d'un loueur."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-6">
          {/* Réservations */}
          <FeatureCard
            icon={CalendarRange}
            title="Réservations"
            description="Visualisez immédiatement les disponibilités et évitez les doubles réservations."
            className="md:col-span-3"
          >
            <div className="rounded-xl border border-neutral-200/80 bg-pc-foam/60 p-3">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-400">
                {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="relative mt-2 h-14">
                {/* Location confirmée */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={inView}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
                  className="absolute left-0 top-0 h-6 w-[42%] origin-left rounded-md bg-pc-turquoise/70 px-2 text-[10px] font-medium leading-6 text-pc-abyss"
                >
                  Scooter · Moana T.
                </motion.div>
                {/* Tentative en conflit, déplacée vers un créneau libre */}
                <motion.div
                  initial={{ opacity: 0, x: "12%" }}
                  whileInView={{ opacity: [0, 1, 1], x: ["12%", "12%", "50%"] }}
                  viewport={inView}
                  transition={{ duration: 1.6, times: [0, 0.4, 1], ease: EASE, delay: 0.9 }}
                  className="absolute top-8 h-6 w-[46%] rounded-md border border-dashed border-pc-coral/60 bg-pc-coral/15 px-2 text-[10px] font-medium leading-6 text-pc-coral"
                >
                  Voiture · 2 jours
                </motion.div>
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={inView}
                transition={{ delay: 2.4, duration: 0.5 }}
                className="mt-1 text-[11px] font-medium text-pc-lagoon"
              >
                ✓ Conflit évité — créneau replacé automatiquement
              </motion.p>
            </div>
          </FeatureCard>

          {/* Clients */}
          <FeatureCard
            icon={UserRound}
            title="Clients"
            description="Retrouvez les coordonnées, les documents et l'historique de chaque client."
            className="md:col-span-3"
            delay={0.08}
          >
            <div className="rounded-xl border border-neutral-200/80 bg-pc-foam/60 p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-xs font-semibold text-white">
                  MT
                </span>
                <div>
                  <p className="text-sm font-medium text-neutral-800">Moana T.</p>
                  <p className="text-[11px] text-neutral-500">Papeete · cliente régulière</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["Permis ✓", "Téléphone ✓", "4 locations", "Caution enregistrée"].map(
                  (chip, i) => (
                    <motion.span
                      key={chip}
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={inView}
                      transition={{ delay: 0.3 + i * 0.12, duration: 0.4, ease: EASE }}
                      className="rounded-full bg-pc-lagoon/10 px-2.5 py-1 text-[11px] font-medium text-pc-lagoon"
                    >
                      {chip}
                    </motion.span>
                  )
                )}
              </div>
            </div>
          </FeatureCard>

          {/* Contrats */}
          <FeatureCard
            icon={FileText}
            title="Contrats"
            description="Générez les documents à partir des informations de la réservation."
            className="md:col-span-2"
            delay={0.12}
          >
            <div className="rounded-xl border border-neutral-200/80 bg-pc-foam/60 p-3">
              <div className="space-y-1.5">
                {[80, 100, 62].map((w, i) => (
                  <motion.span
                    key={i}
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={inView}
                    transition={{ delay: 0.3 + i * 0.15, duration: 0.5, ease: EASE }}
                    className="block h-1.5 origin-left rounded-full bg-neutral-300/80"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={inView}
                transition={{ delay: 0.9, duration: 0.5, ease: EASE }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-pc-turquoise/15 px-2.5 py-1 text-[11px] font-medium text-pc-lagoon"
              >
                <Check className="size-3" aria-hidden />
                Généré depuis la réservation
              </motion.p>
            </div>
          </FeatureCard>

          {/* Paiements */}
          <FeatureCard
            icon={Wallet}
            title="Paiements"
            description="Suivez les paiements en ligne, en espèces ou par virement."
            className="md:col-span-2"
            delay={0.16}
          >
            <div className="rounded-xl border border-neutral-200/80 bg-pc-foam/60 p-3 text-[12px]">
              <div className="flex justify-between text-neutral-600">
                <span>Acompte · espèces</span>
                <span className="font-medium text-neutral-800">9 000 XPF</span>
              </div>
              <div className="mt-1.5 flex justify-between text-neutral-600">
                <span>Solde · virement</span>
                <span className="font-medium text-neutral-800">9 000 XPF</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                <motion.div
                  initial={{ width: "0%" }}
                  whileInView={{ width: "100%" }}
                  viewport={inView}
                  transition={{ delay: 0.4, duration: 1, ease: EASE }}
                  className="h-full rounded-full bg-gradient-to-r from-pc-lagoon to-pc-turquoise"
                />
              </div>
              <p className="mt-1.5 text-right text-[11px] font-medium text-pc-lagoon">
                18 000 / 18 000 XPF — soldé
              </p>
            </div>
          </FeatureCard>

          {/* Inventaire */}
          <FeatureCard
            icon={Package}
            title="Inventaire"
            description="Disponible, réservé, en location, en entretien ou indisponible."
            className="md:col-span-2"
            delay={0.2}
          >
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Disponible", dot: "bg-emerald-500" },
                { label: "Réservé", dot: "bg-pc-turquoise" },
                { label: "En location", dot: "bg-pc-gold" },
                { label: "En entretien", dot: "bg-sky-400" },
                { label: "Indisponible", dot: "bg-pc-coral" },
              ].map((status, i) => (
                <motion.span
                  key={status.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={inView}
                  transition={{ delay: 0.25 + i * 0.1, duration: 0.4, ease: EASE }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700"
                >
                  <span className={cn("size-1.5 rounded-full", status.dot)} aria-hidden />
                  {status.label}
                </motion.span>
              ))}
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
