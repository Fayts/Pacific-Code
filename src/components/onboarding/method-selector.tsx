"use client";

import Link from "next/link";
import {
  ClipboardPaste,
  FileSpreadsheet,
  FileText,
  Globe,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ImportSource } from "@/lib/types/import";

const EASE = [0.16, 1, 0.3, 1] as const;

type MethodId = Extract<ImportSource, "file" | "text" | "assistant" | "express" | "website">;

const METHODS: Array<{
  id: MethodId;
  icon: LucideIcon;
  title: string;
  text: string;
  cta: string;
  badge?: string;
}> = [
  {
    id: "assistant",
    icon: Sparkles,
    title: "Je décris mon activité",
    text: "Conversez avec l’agent IA : il construit votre entreprise, vos biens et vos tarifs avec vous, en direct.",
    cta: "Démarrer avec l’agent IA",
    badge: "Recommandé",
  },
  {
    id: "file",
    icon: FileSpreadsheet,
    title: "J’ai déjà un catalogue",
    text: "Importez un fichier CSV (Excel : enregistrez en CSV).",
    cta: "Importer un fichier",
  },
  {
    id: "text",
    icon: ClipboardPaste,
    title: "Je colle mes annonces",
    text: "Collez une description ou plusieurs annonces, l’analyse fait le tri.",
    cta: "Coller un texte",
  },
  {
    id: "express",
    icon: Zap,
    title: "Démarrage express",
    text: "Choisissez votre type d’activité, on prépare la structure de départ.",
    cta: "Créer la structure",
  },
  {
    id: "website",
    icon: Globe,
    title: "J’ai un site ou une Page Facebook",
    text: "Récupérez automatiquement vos informations publiques : entreprise, biens, tarifs.",
    cta: "Importer automatiquement",
    badge: "Nouveau",
  },
];

export function MethodSelector({
  onSelect,
  onSelectBrochure,
}: {
  onSelect: (method: MethodId) => void;
  /** Brochure PDF / photo de tarifs : ouvre l'agent IA orienté document. */
  onSelectBrochure: () => void;
}) {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {METHODS.map((method, i) => {
          const Icon = method.icon;
          return (
            <motion.button
              key={method.id}
              type="button"
              onClick={() => onSelect(method.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.05 * i }}
              className={cn(
                "group flex flex-col rounded-2xl bg-card p-6 text-left shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]",
                "transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-pc-deep/10 hover:ring-primary/30",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-lagoon/25 transition duration-300 group-hover:scale-110">
                  <Icon className="size-5" aria-hidden />
                </span>
                {method.badge && (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
                      method.badge === "Démo"
                        ? "bg-amber-50 text-amber-800 ring-amber-200"
                        : "bg-pc-turquoise/10 text-pc-lagoon ring-pc-turquoise/30"
                    )}
                  >
                    {method.badge}
                  </span>
                )}
              </div>
              <h3 className="mt-4 font-semibold text-foreground">
                {method.title}
              </h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
                {method.text}
              </p>
              <span className="mt-4 text-sm font-semibold text-primary transition group-hover:translate-x-0.5">
                {method.cta} →
              </span>
            </motion.button>
          );
        })}

        {/* Brochure / photo : analysée par l'agent IA (blocs image + PDF). */}
        <motion.button
          type="button"
          onClick={onSelectBrochure}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.25 }}
          className={cn(
            "group flex flex-col rounded-2xl bg-card p-6 text-left shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]",
            "transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-pc-deep/10 hover:ring-primary/30",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-lagoon/25 transition duration-300 group-hover:scale-110">
              <FileText className="size-5" aria-hidden />
            </span>
            <span className="rounded-full bg-pc-turquoise/10 px-2.5 py-0.5 text-xs font-medium text-pc-lagoon ring-1 ring-pc-turquoise/30">
              Nouveau
            </span>
          </div>
          <h3 className="mt-4 font-semibold text-foreground">
            J’ai une brochure ou une photo de mes tarifs
          </h3>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
            Joignez un PDF ou photographiez votre grille tarifaire : l’agent IA
            en extrait vos biens et vos prix.
          </p>
          <span className="mt-4 text-sm font-semibold text-primary transition group-hover:translate-x-0.5">
            Analyser mon document →
          </span>
        </motion.button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Vous préférez tout saisir vous-même ?{" "}
        <Link
          href="/equipment/new"
          className="font-medium text-primary hover:underline"
        >
          Configuration manuelle
        </Link>
      </p>
    </div>
  );
}
