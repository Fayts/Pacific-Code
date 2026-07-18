"use client";

import { useRef } from "react";
import {
  Banknote,
  Car,
  CalendarCheck2,
  Clock3,
  FileText,
  type LucideIcon,
} from "lucide-react";
import {
  motion,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";
import { DashboardPreview } from "@/components/landing/dashboard-preview";
import { useSectionProgress } from "@/components/landing/use-section-progress";

const CHIPS: {
  icon: LucideIcon;
  label: string;
  tone: string;
  position: string;
  start: number;
}[] = [
  {
    icon: CalendarCheck2,
    label: "Réservation confirmée",
    tone: "text-pc-turquoise",
    position: "-left-2 top-[10%]",
    start: 0.3,
  },
  {
    icon: Car,
    label: "Véhicule disponible",
    tone: "text-emerald-300",
    position: "-right-3 top-[26%]",
    start: 0.38,
  },
  {
    icon: FileText,
    label: "Contrat envoyé",
    tone: "text-pc-mist",
    position: "left-0 bottom-[36%]",
    start: 0.46,
  },
  {
    icon: Banknote,
    label: "Paiement enregistré",
    tone: "text-pc-gold",
    position: "-right-4 bottom-[20%]",
    start: 0.54,
  },
  {
    icon: Clock3,
    label: "Retour prévu à 17 h",
    tone: "text-pc-coral",
    position: "left-[30%] -bottom-7",
    start: 0.62,
  },
];

function ActivityChip({
  progress,
  chip,
  className,
  floatDelay,
}: {
  progress: MotionValue<number>;
  chip: (typeof CHIPS)[number];
  className?: string;
  floatDelay: number;
}) {
  const opacity = useTransform(progress, [chip.start, chip.start + 0.1], [0, 1]);
  const y = useTransform(progress, [chip.start, chip.start + 0.12], [28, 0]);
  const Icon = chip.icon;

  return (
    <motion.div style={{ opacity, y }} className={className}>
      <span
        className="pc-float flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.07] px-3.5 py-2.5 shadow-xl shadow-black/20 backdrop-blur-md"
        style={{ animationDelay: `${floatDelay}s`, animationDuration: "8s" }}
      >
        <Icon className={cn("size-4 shrink-0", chip.tone)} aria-hidden />
        <span className="whitespace-nowrap text-sm font-medium text-white">
          {chip.label}
        </span>
      </span>
    </motion.div>
  );
}

// Le tableau de bord grandit pendant que les événements du quotidien
// viennent se ranger autour de lui.
export function ActivitySection() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const scrollYProgress = useSectionProgress(ref);

  const headingOpacity = useTransform(scrollYProgress, [0.04, 0.2], [0, 1]);
  const headingY = useTransform(scrollYProgress, [0.04, 0.2], [24, 0]);
  const previewScale = useTransform(
    scrollYProgress,
    [0, 0.5],
    [reduce ? 1 : 0.88, 1]
  );
  const previewOpacity = useTransform(scrollYProgress, [0, 0.18], [0, 1]);

  return (
    <div id="activite" ref={ref} className="relative h-[220vh] bg-pc-abyss">
      <div className="sticky top-0 flex h-svh flex-col items-center justify-center overflow-hidden px-6 pt-16 md:pt-0">
        {/* Halo discret derrière l'interface */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(45%_45%_at_50%_55%,rgba(14,127,159,0.18),transparent_70%)]"
        />

        <motion.div
          style={{ opacity: headingOpacity, y: headingY }}
          className="relative mb-6 text-center md:mb-10"
        >
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Toute votre activité, enfin réunie.
          </h2>
          <p className="mt-3 text-base text-white/60 sm:text-lg">
            Chaque réservation, chaque paiement, chaque retour — au même
            endroit.
          </p>
        </motion.div>

        <div className="relative w-full max-w-4xl">
          <motion.div
            style={{ scale: previewScale, opacity: previewOpacity }}
            className="mx-auto w-full max-w-lg"
          >
            <DashboardPreview />
          </motion.div>

          {/* Desktop : les cartes gravitent autour de l'interface */}
          <div aria-hidden className="absolute inset-0 hidden md:block">
            {CHIPS.map((chip, i) => (
              <ActivityChip
                key={chip.label}
                progress={scrollYProgress}
                chip={chip}
                floatDelay={i * 1.3}
                className={cn("absolute", chip.position)}
              />
            ))}
          </div>

          {/* Mobile : les mêmes cartes, en grille sous l'interface */}
          <div className="mt-6 grid grid-cols-2 justify-items-center gap-3 md:hidden">
            {CHIPS.map((chip, i) => (
              <ActivityChip
                key={chip.label}
                progress={scrollYProgress}
                chip={chip}
                floatDelay={i * 1.3}
                className={cn(
                  "[&_span]:whitespace-normal [&_span]:text-xs",
                  i === CHIPS.length - 1 && "col-span-2"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
