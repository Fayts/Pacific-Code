"use client";

import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { DashboardPreview } from "@/components/landing/dashboard-preview";
import { Reveal, EASE } from "@/components/landing/reveal";

// Deux tracés à structure identique : la vague devient courbe de croissance.
const WAVE_PATH =
  "M0,120 C100,92 200,148 300,120 C400,92 500,148 600,120 C700,94 760,132 800,118";
const GROWTH_PATH =
  "M0,168 C100,164 200,156 300,146 C400,132 500,106 600,76 C700,46 760,30 800,22";

function WaveToGrowth() {
  const reduce = useReducedMotion();
  return (
    <svg
      aria-hidden
      viewBox="0 0 800 200"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-48 w-full opacity-60 sm:h-64"
    >
      <defs>
        <linearGradient id="pc-wave-growth" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#38cfe4" />
          <stop offset="1" stopColor="#ffc296" />
        </linearGradient>
      </defs>
      <motion.path
        fill="none"
        stroke="url(#pc-wave-growth)"
        strokeWidth={2.5}
        strokeLinecap="round"
        initial={
          reduce
            ? { d: GROWTH_PATH, pathLength: 1 }
            : { d: WAVE_PATH, pathLength: 0 }
        }
        whileInView={
          reduce
            ? { d: GROWTH_PATH, pathLength: 1 }
            : {
                d: [WAVE_PATH, WAVE_PATH, GROWTH_PATH],
                pathLength: [0, 1, 1],
              }
        }
        viewport={{ once: true, margin: "-20% 0px" }}
        transition={{ duration: 3, times: [0, 0.5, 1], ease: "easeInOut" }}
      />
    </svg>
  );
}

export function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      {/* Crépuscule : la nuit vire doucement au chaud, sans carte postale */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_bottom,#071829_0%,#1b2140_45%,#3a2b44_78%,#54354a_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(55%_60%_at_50%_100%,rgba(255,194,150,0.22),transparent_70%)]"
      />
      <div className="pc-tapa absolute inset-0 opacity-[0.03]" aria-hidden />
      <WaveToGrowth />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center text-white">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Votre activité mérite mieux qu&apos;un agenda et des messages
              dispersés.
            </h2>
            <p className="mt-4 text-lg text-white/75">
              Une solution simple pour gérer vos locations au quotidien.
            </p>
          </Reveal>
          <Reveal delay={0.15} className="mt-9 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pc-coral to-[#ff5d54] px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-pc-coral/30 transition hover:brightness-105"
            >
              Essayer la démo
              <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link
              href="/#parcours"
              className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-base font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Voir comment ça fonctionne
            </Link>
          </Reveal>
        </div>

        {/* Le produit, sur ordinateur et mobile */}
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 1, ease: EASE, delay: 0.2 }}
          className="relative mx-auto mt-16 max-w-2xl"
        >
          {/* Ordinateur */}
          <div className="rounded-t-2xl border border-white/15 border-b-0 bg-pc-abyss/80 p-3 pb-0 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-4 sm:pb-0">
            <DashboardPreview className="rounded-b-none border-b-0" />
          </div>
          <div className="mx-[-3%] h-3 rounded-b-xl bg-white/15" />

          {/* Téléphone */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.5 }}
            className="absolute -right-3 -bottom-10 w-36 sm:-right-10 sm:w-44"
          >
            <div className="rounded-[1.6rem] border border-white/15 bg-pc-abyss/90 p-2 shadow-2xl shadow-black/50 backdrop-blur-sm">
              <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.05] p-2.5">
                <p className="text-[9px] font-semibold text-white">
                  Scooter 125 cc
                </p>
                <p className="text-[8px] text-white/50">Moana T. · 3 jours</p>
                <span className="mt-1.5 inline-block rounded-full bg-pc-turquoise/15 px-2 py-0.5 text-[8px] font-medium text-pc-mist">
                  Confirmée
                </span>
                <div className="mt-2 flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1.5">
                  <Clock3 className="size-2.5 text-pc-coral" aria-hidden />
                  <span className="text-[8px] text-white/70">
                    Retour 17 h
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
