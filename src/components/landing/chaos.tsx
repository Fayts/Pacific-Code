"use client";

import { useRef } from "react";
import {
  Banknote,
  CalendarDays,
  CalendarCheck2,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  StickyNote,
  UserX,
  Waves,
  type LucideIcon,
} from "lucide-react";
import {
  motion,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";
import { useSectionProgress } from "@/components/landing/use-section-progress";

// Les outils dispersés d'un loueur aujourd'hui. Positions en % du conteneur,
// convergence vers le centre pendant le scroll.
const SCATTERED: {
  icon: LucideIcon;
  text: string;
  accent: string;
  left: number;
  top: number;
  rotate: number;
}[] = [
  { icon: MessageCircle, text: "« Le scooter est libre samedi ? »", accent: "border-l-emerald-400", left: 6, top: 16, rotate: -7 },
  { icon: StickyNote, text: "Rappeler Moana avant 17 h", accent: "border-l-amber-400", left: 70, top: 12, rotate: 5 },
  { icon: CalendarDays, text: "Agenda papier raturé", accent: "border-l-sky-400", left: 12, top: 62, rotate: 4 },
  { icon: FileSpreadsheet, text: "locations_v3_FINAL.xlsx", accent: "border-l-green-500", left: 74, top: 58, rotate: -5 },
  { icon: FileText, text: "contrat_scan_2.pdf", accent: "border-l-red-400", left: 30, top: 6, rotate: 3 },
  { icon: Banknote, text: "Acompte en espèces, noté nulle part", accent: "border-l-pc-gold", left: 44, top: 72, rotate: -3 },
  { icon: UserX, text: "N° de permis manquant", accent: "border-l-pc-coral", left: 2, top: 38, rotate: 6 },
];

function ScatteredChip({
  progress,
  item,
}: {
  progress: MotionValue<number>;
  item: (typeof SCATTERED)[number];
}) {
  // Trajectoire vers le centre du conteneur (approximation en vw/vh, les
  // puces disparaissent à l'arrivée : la précision n'a pas d'importance).
  const appear = useTransform(progress, [0.04, 0.14], [0, 1]);
  const gone = useTransform(progress, [0.52, 0.66], [1, 0]);
  const opacity = useTransform(() => appear.get() * gone.get());
  const x = useTransform(progress, [0.2, 0.64], ["0vw", `${(46 - item.left) * 0.72}vw`]);
  const y = useTransform(progress, [0.2, 0.64], ["0vh", `${(44 - item.top) * 0.5}vh`]);
  const rotate = useTransform(progress, [0.2, 0.64], [item.rotate, 0]);
  const scale = useTransform(progress, [0.2, 0.64], [1, 0.55]);
  const Icon = item.icon;

  return (
    <motion.div
      style={{ left: `${item.left}%`, top: `${item.top}%`, opacity, x, y, rotate, scale }}
      className="absolute"
    >
      <span
        className={cn(
          "flex max-w-[46vw] items-center gap-2 rounded-lg border border-neutral-200 border-l-4 bg-white px-3 py-2 shadow-lg shadow-pc-deep/10 sm:max-w-none",
          item.accent
        )}
      >
        <Icon className="size-4 shrink-0 text-neutral-500" aria-hidden />
        <span className="text-xs font-medium text-neutral-700 sm:text-sm">
          {item.text}
        </span>
      </span>
    </motion.div>
  );
}

const RESOLVED = [
  { icon: CalendarCheck2, text: "Disponibilités à jour" },
  { icon: FileText, text: "Contrat généré" },
  { icon: Banknote, text: "Acompte enregistré — 9 000 XPF" },
];

export function ChaosSection() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const scrollYProgress = useSectionProgress(ref);

  const title1Opacity = useTransform(scrollYProgress, [0.06, 0.16, 0.36, 0.46], [0, 1, 1, 0]);
  const title2Opacity = useTransform(scrollYProgress, [0.5, 0.62], [0, 1]);
  const title2Y = useTransform(scrollYProgress, [0.5, 0.62], [18, 0]);
  const cardOpacity = useTransform(scrollYProgress, [0.42, 0.56], [0, 1]);
  const cardScale = useTransform(scrollYProgress, [0.42, 0.62], [reduce ? 1 : 0.9, 1]);

  if (reduce) {
    // Version statique : le résultat, sans la chorégraphie.
    return (
      <section id="centraliser" className="bg-pc-foam px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            Centralisez tout dans un seul outil.
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            Messages, notes, tableurs, contrats et paiements dispersés — tout
            revient au même endroit.
          </p>
          <CentralCard className="mx-auto mt-10 max-w-sm" showRows />
        </div>
      </section>
    );
  }

  return (
    <div id="centraliser" ref={ref} className="relative h-[260vh] bg-pc-foam">
      {/* Pont de couleur depuis la section sombre précédente */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-pc-abyss to-transparent"
      />
      <div className="sticky top-0 flex h-svh flex-col items-center justify-center overflow-hidden px-6">
        {/* Titres superposés qui se relaient */}
        <div className="relative z-10 mb-8 h-24 w-full max-w-2xl text-center sm:h-20">
          <motion.h2
            style={{ opacity: title1Opacity }}
            className="absolute inset-x-0 text-3xl font-semibold tracking-tight text-neutral-900 text-balance sm:text-4xl"
          >
            Vos locations sont dispersées partout&nbsp;?
          </motion.h2>
          <motion.h2
            style={{ opacity: title2Opacity, y: title2Y }}
            className="absolute inset-x-0 text-3xl font-semibold tracking-tight text-neutral-900 text-balance sm:text-4xl"
          >
            Centralisez tout{" "}
            <span className="text-pc-lagoon">dans un seul outil.</span>
          </motion.h2>
        </div>

        {/* Scène : puces dispersées + interface centrale */}
        <div className="relative h-[52svh] w-full max-w-4xl">
          {SCATTERED.map((item) => (
            <ScatteredChip key={item.text} progress={scrollYProgress} item={item} />
          ))}

          <motion.div
            style={{ opacity: cardOpacity, scale: cardScale }}
            className="absolute left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2"
          >
            <CentralCard progress={scrollYProgress} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function CentralCard({
  progress,
  className,
  showRows = false,
}: {
  progress?: MotionValue<number>;
  className?: string;
  showRows?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-pc-lagoon/15 bg-white/90 p-5 shadow-2xl shadow-pc-deep/15 backdrop-blur-md",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white">
          <Waves className="size-4" aria-hidden />
        </span>
        <div className="text-left">
          <p className="text-sm font-semibold text-neutral-900">Pacific Code</p>
          <p className="text-xs text-neutral-500">Un seul espace de travail</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {RESOLVED.map((row, i) => (
          <ResolvedRow
            key={row.text}
            row={row}
            index={i}
            progress={progress}
            forceVisible={showRows}
          />
        ))}
      </div>
    </div>
  );
}

function ResolvedRow({
  row,
  index,
  progress,
  forceVisible,
}: {
  row: (typeof RESOLVED)[number];
  index: number;
  progress?: MotionValue<number>;
  forceVisible: boolean;
}) {
  const start = 0.62 + index * 0.07;
  const fallback = useTransform(() => 1);
  const opacity = useTransform(
    progress ?? fallback,
    [start, start + 0.06],
    forceVisible || !progress ? [1, 1] : [0, 1]
  );
  const Icon = row.icon;

  return (
    <motion.div
      style={{ opacity }}
      className="flex items-center gap-2.5 rounded-lg bg-pc-foam px-3 py-2.5 text-left"
    >
      <Icon className="size-4 shrink-0 text-pc-lagoon" aria-hidden />
      <span className="text-sm font-medium text-neutral-800">{row.text}</span>
      <span className="ml-auto flex size-4 items-center justify-center rounded-full bg-pc-turquoise/20 text-[10px] font-bold text-pc-lagoon">
        ✓
      </span>
    </motion.div>
  );
}
