"use client";

import { Hourglass, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { motion } from "motion/react";
import { Reveal, SectionHeading, EASE } from "@/components/landing/reveal";

const inView = { once: true, margin: "-15% 0px" } as const;

// Indicateurs volontairement qualitatifs : aucune fausse statistique.

function TimeVisual() {
  return (
    <div className="space-y-2">
      {[
        { label: "Aujourd'hui", width: "92%", tone: "bg-neutral-300" },
        { label: "Avec Pacific Code", width: "34%", tone: "bg-gradient-to-r from-pc-lagoon to-pc-turquoise" },
      ].map((bar, i) => (
        <div key={bar.label}>
          <p className="mb-1 text-[11px] text-neutral-500">{bar.label}</p>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <motion.div
              initial={{ width: "0%" }}
              whileInView={{ width: bar.width }}
              viewport={inView}
              transition={{ duration: 0.9, ease: EASE, delay: 0.3 + i * 0.25 }}
              className={`h-full rounded-full ${bar.tone}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorsVisual() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {["Double réservation", "Retour oublié", "Contrat manquant"].map(
        (err, i) => (
          <motion.span
            key={err}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: [0, 1, 0.45] }}
            viewport={inView}
            transition={{ duration: 1.2, times: [0, 0.4, 1], delay: 0.3 + i * 0.2 }}
            className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-400 line-through decoration-pc-coral/70"
          >
            {err}
          </motion.span>
        )
      )}
    </div>
  );
}

function RevenueVisual() {
  return (
    <svg viewBox="0 0 160 56" className="h-14 w-full" aria-hidden>
      <defs>
        <linearGradient id="pc-rev" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0e7f9f" />
          <stop offset="1" stopColor="#38cfe4" />
        </linearGradient>
      </defs>
      <motion.path
        d="M4,48 C30,46 50,40 74,34 C98,28 122,20 156,8"
        fill="none"
        stroke="url(#pc-rev)"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={inView}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.35 }}
      />
      <motion.circle
        cx="156"
        cy="8"
        r="3"
        fill="#38cfe4"
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={inView}
        transition={{ delay: 1.5, type: "spring", stiffness: 300, damping: 15 }}
      />
    </svg>
  );
}

function ClientsVisual() {
  return (
    <div className="flex items-center">
      {["MT", "JD", "HL"].map((initials, i) => (
        <motion.span
          key={initials}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={inView}
          transition={{ delay: 0.3 + i * 0.15, duration: 0.4, ease: EASE }}
          className="-ml-2 flex size-8 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-[10px] font-semibold text-white first:ml-0"
        >
          {initials}
        </motion.span>
      ))}
      <motion.span
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={inView}
        transition={{ delay: 0.85, duration: 0.5 }}
        className="ml-3 rounded-full bg-pc-lagoon/10 px-2.5 py-1 text-[11px] font-medium text-pc-lagoon"
      >
        Historique complet ✓
      </motion.span>
    </div>
  );
}

const BENEFITS = [
  {
    icon: Hourglass,
    title: "Moins de temps perdu",
    text: "La saisie se fait une fois, tout le reste en découle.",
    visual: <TimeVisual />,
  },
  {
    icon: ShieldCheck,
    title: "Moins d'erreurs",
    text: "Les conflits et les oublis sont détectés avant qu'ils coûtent.",
    visual: <ErrorsVisual />,
  },
  {
    icon: TrendingUp,
    title: "Revenus plus lisibles",
    text: "Ce qui est payé, ce qui reste dû : visible en permanence.",
    visual: <RevenueVisual />,
  },
  {
    icon: Users,
    title: "Clients mieux suivis",
    text: "Chaque client garde son historique et ses documents.",
    visual: <ClientsVisual />,
  },
];

export function BenefitsSection() {
  return (
    <section id="benefices" className="scroll-mt-16 bg-white px-6 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title="Moins d'administratif. Plus de locations."
          lead="Le but n'est pas d'ajouter un outil, mais d'en retirer cinq."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit, i) => {
            const Icon = benefit.icon;
            return (
              <Reveal
                key={benefit.title}
                delay={i * 0.08}
                className="flex flex-col rounded-2xl border border-pc-lagoon/10 bg-pc-foam/60 p-6"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-lagoon/25">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold text-neutral-900">
                  {benefit.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                  {benefit.text}
                </p>
                <div className="mt-5 flex-1 content-end">{benefit.visual}</div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
