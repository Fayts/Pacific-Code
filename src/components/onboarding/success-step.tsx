"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  PartyPopper,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ImportReport, ImportSessionData } from "@/lib/types/import";

const EASE = [0.16, 1, 0.3, 1] as const;

export function SuccessStep({
  report,
  session,
}: {
  report: ImportReport;
  session: ImportSessionData;
}) {
  const activeItems = session.items.filter(
    (i) => !i.excluded && i.duplicateResolution !== "skip"
  );
  const missingPrices = activeItems.filter((i) => i.dailyPrice === null).length;
  const missingDeposits = activeItems.filter(
    (i) => i.depositAmount === null
  ).length;
  const missingDescriptions = activeItems.filter(
    (i) => !i.description.trim()
  ).length;

  const checklist: Array<{ label: string; href: string; done: boolean }> = [
    { label: "Ajouter le logo de l’entreprise", href: "/settings", done: false },
    {
      label:
        missingPrices > 0
          ? `Compléter ${missingPrices} prix manquant${missingPrices > 1 ? "s" : ""}`
          : "Tous les prix sont renseignés",
      href: "/equipment",
      done: missingPrices === 0,
    },
    {
      label:
        missingDeposits > 0
          ? `Vérifier les cautions (${missingDeposits} sans caution)`
          : "Cautions renseignées",
      href: "/equipment",
      done: missingDeposits === 0,
    },
    {
      label:
        missingDescriptions > 0
          ? `Ajouter ${missingDescriptions} description${missingDescriptions > 1 ? "s" : ""} et les photos`
          : "Descriptions renseignées — ajoutez les photos",
      href: "/equipment",
      done: false,
    },
  ];

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/reserver/apercu`
      : "/reserver/apercu";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Lien copié !");
    } catch {
      toast.error("Impossible de copier — sélectionnez le lien manuellement.");
    }
  };

  const stats: Array<[string, number]> = [
    ["Catégories créées", report.createdCategories],
    ["Biens importés", report.createdItems],
    ["Biens remplacés", report.replacedItems],
    ["Lignes ignorées", report.skippedItems],
  ];

  return (
    <div className="mx-auto max-w-2xl text-center">
      <motion.span
        initial={{ scale: 0, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="mx-auto flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-xl shadow-pc-turquoise/30"
      >
        <PartyPopper className="size-8" aria-hidden />
      </motion.span>
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
        className="mt-5 text-2xl font-semibold tracking-tight md:text-3xl"
      >
        Votre activité est prête 🌺
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.25 }}
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl bg-card p-4 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]"
          >
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
        className="mt-6 flex flex-wrap items-center justify-center gap-3"
      >
        <Button
          render={<Link href="/equipment" />}
          className="h-10 bg-gradient-to-r from-pc-lagoon to-pc-turquoise px-5 font-semibold text-white shadow-lg shadow-pc-lagoon/25 hover:brightness-105"
        >
          Voir mon catalogue
        </Button>
        <Button variant="outline" render={<Link href="/reserver/apercu" />}>
          <ExternalLink className="size-4" aria-hidden />
          Ouvrir mon espace de réservation
        </Button>
        <Button variant="outline" onClick={copyLink}>
          <Copy className="size-4" aria-hidden />
          Copier mon lien public
        </Button>
      </motion.div>
      <p className="mt-2 text-xs text-muted-foreground/70">
        En mode démonstration, l’espace public n’est visible que sur cet
        appareil (les données vivent dans votre navigateur).
      </p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.45 }}
        className="mx-auto mt-8 max-w-md rounded-2xl bg-card p-5 text-left shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]"
      >
        <h2 className="text-sm font-semibold text-foreground">
          Pour aller au bout
        </h2>
        <ul className="mt-3 space-y-2.5">
          {checklist.map((step) => (
            <li key={step.label}>
              <Link
                href={step.href}
                className="group flex items-center gap-2.5 text-sm"
              >
                {step.done ? (
                  <CheckCircle2
                    className="size-4 shrink-0 text-emerald-600"
                    aria-hidden
                  />
                ) : (
                  <Circle
                    className="size-4 shrink-0 text-muted-foreground/50"
                    aria-hidden
                  />
                )}
                <span
                  className={
                    step.done
                      ? "text-muted-foreground line-through decoration-muted-foreground/40"
                      : "text-foreground group-hover:text-primary"
                  }
                >
                  {step.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
