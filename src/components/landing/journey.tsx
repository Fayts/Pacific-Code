"use client";

import { useRef, useState } from "react";
import {
  Banknote,
  Bike,
  Calculator,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  KeyRound,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/landing/reveal";
import { useSectionProgress } from "@/components/landing/use-section-progress";

const STEPS: { icon: LucideIcon; label: string }[] = [
  { icon: Bike, label: "Sélection du scooter" },
  { icon: CalendarDays, label: "Choix des dates" },
  { icon: Calculator, label: "Calcul du tarif" },
  { icon: UserRound, label: "Fiche client" },
  { icon: FileText, label: "Génération du contrat" },
  { icon: Banknote, label: "Acompte enregistré" },
  { icon: KeyRound, label: "Remise du véhicule" },
  { icon: Clock3, label: "Retour programmé" },
];

const LAST = STEPS.length - 1;

function statusFor(step: number) {
  if (step >= 6) return { text: "En location", tone: "bg-pc-gold/15 text-amber-700" };
  if (step >= 5) return { text: "Confirmée", tone: "bg-pc-turquoise/15 text-pc-lagoon" };
  return { text: "En préparation", tone: "bg-neutral-200/70 text-neutral-600" };
}

export function JourneySection() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  const scrollYProgress = useSectionProgress(ref);
  const barWidth = useTransform(scrollYProgress, [0.05, 0.94], ["0%", "100%"]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = Math.min(LAST, Math.max(0, Math.floor(((v - 0.06) / 0.88) * STEPS.length)));
    if (next !== step) setStep(next);
  });

  if (reduce) {
    return (
      <section id="parcours" className="bg-pc-foam px-6 py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <JourneyHeading step={LAST} />
          <BookingPanel step={LAST} instant />
        </div>
      </section>
    );
  }

  return (
    <div
      id="parcours"
      ref={ref}
      className="relative h-[520vh] bg-gradient-to-b from-pc-foam via-[#e9f4f6] to-pc-foam"
    >
      <div className="sticky top-0 flex h-svh items-center overflow-hidden px-6">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <div>
            <JourneyHeading step={step} />

            {/* Rail des étapes (desktop) */}
            <ol className="mt-8 hidden space-y-1 lg:block" aria-label="Étapes de la location">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const done = i < step;
                const active = i === step;
                return (
                  <li key={s.label} className="flex items-center gap-3 py-1.5">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors duration-300",
                        done && "border-pc-turquoise/40 bg-pc-turquoise/15 text-pc-lagoon",
                        active && "border-pc-coral bg-white text-pc-coral shadow-md shadow-pc-coral/20",
                        !done && !active && "border-neutral-300 bg-white text-neutral-400"
                      )}
                    >
                      {done ? <Check className="size-3.5" aria-hidden /> : <Icon className="size-3.5" aria-hidden />}
                    </span>
                    <span
                      className={cn(
                        "text-sm transition-colors duration-300",
                        active ? "font-semibold text-neutral-900" : done ? "text-neutral-600" : "text-neutral-400"
                      )}
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>

            {/* Barre de progression (mobile) */}
            <div className="mt-6 lg:hidden">
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
                <motion.div
                  style={{ width: barWidth }}
                  className="h-full rounded-full bg-gradient-to-r from-pc-lagoon to-pc-turquoise"
                />
              </div>
              <p className="mt-2 text-sm font-medium text-pc-lagoon">
                {step + 1}/{STEPS.length} · {STEPS[step].label}
              </p>
            </div>
          </div>

          <BookingPanel step={step} />
        </div>
      </div>
    </div>
  );
}

function JourneyHeading({ step }: { step: number }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-widest text-pc-lagoon">
        Le parcours
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 text-balance sm:text-4xl">
        Moana réserve un scooter pour trois jours.
      </h2>
      <p className="mt-4 hidden text-lg text-neutral-600 sm:block">
        Une location complète, étape par étape — sans rien ressaisir.
      </p>
      <AnimatePresence>
        {step >= LAST && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mt-4 text-lg font-semibold text-pc-lagoon"
          >
            Tout est prêt. Sans double saisie, sans oubli.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({
  visible,
  instant,
  children,
  className,
}: {
  visible: boolean;
  instant?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence initial={!instant}>
      {visible && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5, ease: EASE }}
          className={cn(
            "rounded-xl border border-neutral-200/80 bg-white px-4 py-3",
            className
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// La fiche de location qui se construit au fil des étapes.
function BookingPanel({ step, instant = false }: { step: number; instant?: boolean }) {
  const status = statusFor(step);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-4 rounded-[1.8rem] bg-pc-turquoise/10 blur-2xl"
      />
      <motion.div
        layout={!instant}
        className="relative rounded-2xl border border-pc-lagoon/15 bg-white/85 p-5 shadow-2xl shadow-pc-deep/10 backdrop-blur-md sm:p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              Nouvelle location
            </p>
            <p className="text-xs text-neutral-500">Zone Papeete</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", status.tone)}>
            {status.text}
          </span>
        </div>

        <div className="mt-4 space-y-2.5">
          {/* 1 — Choix du bien */}
          <Row visible instant={instant}>
            <p className="text-xs text-neutral-500">Bien loué</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {["Scooter 125 cc", "Voiture citadine", "Paddle"].map((item, i) => (
                <span
                  key={item}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-300",
                    i === 0 && step >= 0
                      ? "border-pc-lagoon bg-pc-lagoon/10 text-pc-lagoon"
                      : "border-neutral-200 text-neutral-400"
                  )}
                >
                  {item}
                </span>
              ))}
            </div>
          </Row>

          {/* 2 — Dates */}
          <Row visible={step >= 1} instant={instant}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CalendarDays className="size-4 text-pc-lagoon" aria-hidden />
                <p className="text-sm font-medium text-neutral-800">
                  12 → 15 juillet
                </p>
              </div>
              <span className="text-xs text-neutral-500">3 jours</span>
            </div>
          </Row>

          {/* 3 — Tarif */}
          <Row visible={step >= 2} instant={instant}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-neutral-600">3 j × 6 000 XPF</p>
              <p className="text-sm font-semibold text-neutral-900">
                18 000 XPF
              </p>
            </div>
          </Row>

          {/* 4 — Client */}
          <Row visible={step >= 3} instant={instant}>
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-xs font-semibold text-white">
                MT
              </span>
              <div>
                <p className="text-sm font-medium text-neutral-800">Moana T.</p>
                <p className="text-xs text-neutral-500">
                  Permis ✓ · +689 87 00 00 00
                </p>
              </div>
            </div>
          </Row>

          {/* 5 & 6 — Contrat et acompte */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Row visible={step >= 4} instant={instant}>
              <div className="flex items-center gap-2.5">
                <FileText className="size-4 shrink-0 text-pc-coral" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-800">
                    Contrat généré
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    location_moana.pdf
                  </p>
                </div>
              </div>
            </Row>
            <Row visible={step >= 5} instant={instant}>
              <div className="flex items-center gap-2.5">
                <Banknote className="size-4 shrink-0 text-emerald-600" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-800">
                    Acompte reçu
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    9 000 XPF · espèces
                  </p>
                </div>
              </div>
            </Row>
          </div>

          {/* 7 — Remise */}
          <Row visible={step >= 6} instant={instant}>
            <div className="flex items-center gap-2.5">
              <KeyRound className="size-4 text-pc-lagoon" aria-hidden />
              <p className="text-sm font-medium text-neutral-800">
                Véhicule remis à Moana
              </p>
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-pc-turquoise/20">
                <Check className="size-3 text-pc-lagoon" aria-hidden />
              </span>
            </div>
          </Row>

          {/* 8 — Retour */}
          <Row
            visible={step >= 7}
            instant={instant}
            className="border-pc-lagoon/30 bg-pc-lagoon/[0.04]"
          >
            <div className="flex items-center gap-2.5">
              <Clock3 className="size-4 text-pc-coral" aria-hidden />
              <p className="text-sm font-medium text-neutral-800">
                Retour programmé — demain, 17 h
              </p>
            </div>
          </Row>
        </div>
      </motion.div>
    </div>
  );
}
