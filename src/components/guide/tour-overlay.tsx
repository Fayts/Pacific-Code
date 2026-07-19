"use client";

// La visite guidée « caméra » : un voile assombrit l'écran, une fenêtre
// lumineuse glisse d'un élément à l'autre (ressort), un halo respire
// autour de la cible, et une carte en verre présente chaque
// fonctionnalité en une phrase. Purement visuelle : aucune action
// demandée, aucune donnée créée.

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useGuide } from "@/components/guide/guide-provider";

const EASE = [0.16, 1, 0.3, 1] as const;
const CAMERA = { type: "spring", stiffness: 340, damping: 32, mass: 0.85 } as const;
const PADDING = 10;
const CARD_WIDTH = 340;
const CARD_HEIGHT = 240; // estimation pour le placement (avec clamp)

type Rect = { top: number; left: number; width: number; height: number };

function sameRect(a: Rect | null, b: Rect) {
  return (
    !!a &&
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height
  );
}

// La carte se place à droite de la cible si la place le permet (liens de
// la navigation), sinon dessous puis dessus, toujours dans l'écran.
function placeCard(rect: Rect | null): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect) {
    return {
      top: Math.max(24, vh / 2 - CARD_HEIGHT / 2),
      left: Math.max(16, vw / 2 - CARD_WIDTH / 2),
    };
  }
  const clampTop = (v: number) =>
    Math.min(Math.max(16, v), Math.max(16, vh - CARD_HEIGHT - 16));
  const spaceRight = vw - (rect.left + rect.width);
  if (spaceRight >= CARD_WIDTH + 32) {
    return { top: clampTop(rect.top - 6), left: rect.left + rect.width + 20 };
  }
  const left = Math.min(
    Math.max(16, rect.left + rect.width - CARD_WIDTH),
    vw - CARD_WIDTH - 16
  );
  const spaceBelow = vh - (rect.top + rect.height);
  if (spaceBelow >= CARD_HEIGHT + 24) {
    return { top: rect.top + rect.height + 16, left };
  }
  return { top: clampTop(rect.top - CARD_HEIGHT - 16), left };
}

const CONFETTI = [
  "bg-pc-turquoise",
  "bg-pc-coral",
  "bg-pc-gold",
  "bg-pc-mist",
  "bg-emerald-400",
  "bg-pc-turquoise",
  "bg-pc-coral",
  "bg-pc-gold",
];

function Confetti() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-8">
      {CONFETTI.map((tone, i) => {
        const angle = (i / CONFETTI.length) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos(angle) * (44 + (i % 3) * 14),
              y: Math.sin(angle) * (34 + (i % 3) * 12) - 18,
              scale: 0.4,
              rotate: i % 2 ? 120 : -120,
            }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.15 }}
            className={cn(
              "absolute left-1/2 top-0 size-1.5 rounded-[2px]",
              tone
            )}
          />
        );
      })}
    </span>
  );
}

export function GuideTour() {
  const guide = useGuide();
  const reduce = useReducedMotion();
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);

  const active = guide.status === "active";
  const { step, isFinale } = guide;

  // Mesure de la cible : boucle rAF (la cible peut apparaître avec un
  // léger délai), mise à jour uniquement quand la position change.
  useEffect(() => {
    if (!active || !step) return;
    let frame = 0;
    let tries = 0;
    let last: Rect | null = null;

    const measure = () => {
      const element = document.querySelector(step.selector);
      // Une cible masquée (ex. navigation repliée sur mobile) a un
      // rectangle de taille nulle : on la traite comme absente.
      const box = element?.getBoundingClientRect();
      if (!element || !box || box.width < 2 || box.height < 2) {
        tries += 1;
        if (tries > 45) {
          // Cible absente (ex. navigation masquée sur mobile) :
          // carte centrée, sans fenêtre.
          setRect(null);
          setMissing(true);
        } else {
          frame = requestAnimationFrame(measure);
        }
        return;
      }
      const next: Rect = {
        top: box.top - PADDING,
        left: box.left - PADDING,
        width: box.width + PADDING * 2,
        height: box.height + PADDING * 2,
      };
      if (!sameRect(last, next)) {
        last = next;
        setRect(next);
        setMissing(false);
      }
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [active, step]);

  // L'écran reste stable pendant la visite.
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);

  // Navigation clavier : ← → pour naviguer, Échap pour quitter.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (guide.isFinale) guide.finish();
        else guide.skip();
      } else if (event.key === "ArrowRight" && !guide.isFinale) {
        guide.next();
      } else if (event.key === "ArrowLeft" && !guide.isFinale) {
        guide.prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, guide]);

  const count = guide.steps.length;
  const num = Math.min(guide.stepIndex + 1, count);
  const cardPos =
    active && typeof window !== "undefined"
      ? placeCard(isFinale ? null : rect)
      : null;
  const spring = reduce ? { duration: 0 } : CAMERA;

  return (
    <AnimatePresence>
      {active && cardPos && (
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="Visite guidée"
        >
          {/* Couche cliquable : avancer d'une étape. */}
          <button
            type="button"
            tabIndex={-1}
            aria-label={isFinale ? "Terminer la visite" : "Étape suivante"}
            onClick={isFinale ? guide.finish : guide.next}
            className="absolute inset-0 cursor-default"
          />

          {/* Voile : percé d'une fenêtre qui glisse vers la cible, ou
              uniforme (écran final, cible absente). */}
          {!isFinale && !missing && rect ? (
            <motion.div
              aria-hidden
              initial={false}
              animate={{
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
              }}
              transition={spring}
              className="pointer-events-none absolute rounded-xl"
              style={{ boxShadow: "0 0 0 200vmax rgba(4, 16, 29, 0.62)" }}
            >
              {/* Halo qui respire */}
              <span
                aria-hidden
                className="pc-breathe absolute -inset-1.5 rounded-[14px] ring-2 ring-pc-turquoise/40"
              />
              {/* Liseré net + lueur */}
              <span
                aria-hidden
                className="absolute inset-0 rounded-xl shadow-[0_0_26px_2px_rgba(56,207,228,0.4)] ring-2 ring-pc-turquoise/80"
              />
              {/* Impulsion d'arrivée : léger zoom qui se pose */}
              {!reduce && step && (
                <motion.span
                  key={step.id}
                  aria-hidden
                  initial={{ opacity: 0.8, scale: 1.16 }}
                  animate={{ opacity: 0, scale: 1 }}
                  transition={{ duration: 0.7, ease: EASE }}
                  className="absolute inset-0 rounded-xl ring-2 ring-pc-turquoise/60"
                />
              )}
            </motion.div>
          ) : (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-pc-abyss/62"
            />
          )}

          {/* Carte : glisse avec la caméra, contenu qui se renouvelle. */}
          <motion.div
            initial={false}
            animate={{ top: cardPos.top, left: cardPos.left }}
            transition={spring}
            className="absolute w-[340px] max-w-[calc(100vw-2rem)]"
          >
            <AnimatePresence mode="wait" initial={false}>
              {isFinale ? (
                <motion.div
                  key="finale"
                  initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.32, ease: EASE }}
                  className="relative overflow-hidden rounded-2xl bg-white/90 p-6 text-center shadow-2xl shadow-pc-abyss/40 ring-1 ring-pc-deep/10 backdrop-blur-xl"
                >
                  {!reduce && <Confetti />}
                  <motion.span
                    initial={reduce ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.05 }}
                    className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-turquoise/30"
                  >
                    <PartyPopper className="size-6" aria-hidden />
                  </motion.span>
                  <p className="mt-3 text-lg font-semibold text-foreground">
                    Votre visite est terminée 🎉
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    Vous connaissez maintenant les principales fonctionnalités.
                    Il ne vous reste plus qu’à commencer à gérer votre activité.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <Button
                      onClick={guide.finish}
                      className="h-10 w-full bg-gradient-to-r from-pc-lagoon to-pc-turquoise font-semibold text-white shadow-lg shadow-pc-lagoon/25 hover:brightness-105"
                    >
                      Commencer
                    </Button>
                    <Button variant="outline" onClick={guide.restart}>
                      Revoir le tutoriel
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground/70">
                    Relançable à tout moment depuis le bouton
                    «&nbsp;?&nbsp;» en haut de l’écran.
                  </p>
                </motion.div>
              ) : step ? (
                <motion.div
                  key="steps"
                  initial={reduce ? false : { opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="overflow-hidden rounded-2xl bg-white/90 p-5 shadow-2xl shadow-pc-abyss/40 ring-1 ring-pc-deep/10 backdrop-blur-xl"
                >
                  {/* Contenu de l'étape (se renouvelle en fondu) */}
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={step.id}
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.22, ease: EASE }}
                    >
                      <div className="flex items-center gap-3">
                        <motion.span
                          key={`icon-${step.id}`}
                          initial={reduce ? false : { scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 18,
                            delay: 0.04,
                          }}
                          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-turquoise/30"
                        >
                          <step.icon className="pc-lift size-5" aria-hidden />
                        </motion.span>
                        <p className="text-[15px] font-semibold text-foreground">
                          {step.title}
                        </p>
                      </div>
                      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                        {step.text}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  {/* Progression + navigation : stables entre les étapes */}
                  <div className="mt-4 flex items-center gap-3">
                    <span className="whitespace-nowrap text-[11px] font-medium tabular-nums text-muted-foreground">
                      Étape {num} sur {count}
                    </span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-pc-deep/10">
                      <motion.div
                        initial={false}
                        animate={{ width: `${(num / count) * 100}%` }}
                        transition={{ duration: 0.45, ease: EASE }}
                        className="h-full rounded-full bg-gradient-to-r from-pc-lagoon to-pc-turquoise"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={guide.skip}
                      className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
                    >
                      Passer la visite
                    </button>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={guide.prev}
                        disabled={num === 1}
                        className="h-8 px-2.5 text-muted-foreground"
                      >
                        <ArrowLeft className="size-3.5" aria-hidden />
                        Précédent
                      </Button>
                      <Button
                        size="sm"
                        onClick={guide.next}
                        className="h-8 bg-gradient-to-r from-pc-lagoon to-pc-turquoise px-3.5 font-semibold text-white shadow-md shadow-pc-lagoon/25 hover:brightness-105"
                      >
                        {num === count ? "Terminer" : "Suivant"}
                        <ArrowRight className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
