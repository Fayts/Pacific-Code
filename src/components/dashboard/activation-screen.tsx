"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ClipboardPaste,
  FileSpreadsheet,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import type { OnboardingProgress } from "@/lib/core/onboarding";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";

const EASE = [0.16, 1, 0.3, 1] as const;

const METHODS: Array<{
  icon: LucideIcon;
  label: string;
  text: string;
  href: string;
}> = [
  {
    icon: FileSpreadsheet,
    label: "Importer un fichier",
    text: "CSV ou Excel (enregistré en CSV), avec modèle fourni.",
    href: "/onboarding",
  },
  {
    icon: Sparkles,
    label: "Décrire mon activité avec l'IA",
    text: "Répondez à quelques questions, le catalogue se prépare.",
    href: "/onboarding",
  },
  {
    icon: ClipboardPaste,
    label: "Copier une annonce",
    text: "Collez vos annonces existantes, l'analyse fait le tri.",
    href: "/onboarding",
  },
  {
    icon: PencilLine,
    label: "Ajouter manuellement",
    text: "Fiche par fiche, pour garder la main sur chaque détail.",
    href: "/equipment/new",
  },
];

// Écran d'activation : remplace le dashboard tant que l'entreprise
// n'est pas configurée. L'import est l'action principale du produit.
export function ActivationScreen({
  progress,
}: {
  progress: OnboardingProgress;
}) {
  return (
    <div className="mx-auto max-w-4xl py-4 md:py-8">
      {/* Bloc principal */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pc-night via-pc-deep to-pc-lagoon p-8 text-white shadow-xl shadow-pc-deep/20 md:p-12"
      >
        <div
          aria-hidden
          className="pc-tapa absolute inset-0 opacity-[0.05]"
        />
        <div
          aria-hidden
          className="absolute -right-24 -top-24 size-72 rounded-full bg-pc-turquoise/15 blur-3xl"
        />
        <div className="relative max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-medium backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-pc-turquoise" aria-hidden />
            Bienvenue sur Pacific Code
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Configurez votre activité en quelques minutes
          </h1>
          <p className="mt-3 text-white/75 md:text-lg">
            Importez votre catalogue, vos tarifs et vos informations
            d’entreprise pour commencer à recevoir des réservations.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pc-coral to-[#ff5d54] px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-pc-coral/30 transition hover:brightness-105"
            >
              Importer mon activité
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/equipment/new"
              className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Ajouter manuellement
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Méthodes + checklist */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="grid gap-3 sm:grid-cols-2">
          {METHODS.map((method, i) => {
            const Icon = method.icon;
            return (
              <motion.div
                key={method.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.15 + i * 0.07 }}
              >
                <Link
                  href={method.href}
                  className="group flex h-full flex-col rounded-2xl bg-card p-5 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08] transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-pc-deep/10 hover:ring-primary/30"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-lagoon/25 transition duration-300 group-hover:scale-110">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-foreground">
                    {method.label}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {method.text}
                  </p>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
        >
          <OnboardingChecklist progress={progress} className="h-full" />
        </motion.div>
      </div>
    </div>
  );
}
