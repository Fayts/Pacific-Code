"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { motion, useReducedMotion, useTransform } from "motion/react";
import { DashboardPreview } from "@/components/landing/dashboard-preview";
import { MountainsBack, MountainsFront } from "@/components/landing/decor";
import { EASE } from "@/components/landing/reveal";
import { useSectionProgress } from "@/components/landing/use-section-progress";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  // Progression de sortie du héro (0 = en haut, 1 = héro entièrement passé).
  const scrollYProgress = useSectionProgress(ref, "exit");

  // Parallaxe : les montagnes du fond reculent moins vite que le premier plan.
  const backY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 60]);
  const frontY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 140]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -80]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const enter = (delay: number) => ({
    initial: { opacity: 0, y: 32 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, ease: EASE, delay },
  });

  return (
    <section
      ref={ref}
      className="relative flex min-h-svh flex-col overflow-hidden bg-pc-night"
    >
      {/* Ciel : nuit → lagon vers l'horizon */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_bottom,#04101d_0%,#071829_38%,#0b3a55_74%,#0e7f9f_100%)]"
      />
      {/* Halo turquoise à l'horizon */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(60%_70%_at_50%_100%,rgba(56,207,228,0.28),transparent_70%)]"
      />

      {/* Montagnes en parallaxe */}
      <motion.div
        aria-hidden
        style={{ y: backY }}
        className="absolute inset-x-0 bottom-0 h-64 text-pc-deep/80 sm:h-80"
      >
        <MountainsBack />
      </motion.div>
      <motion.div
        aria-hidden
        style={{ y: frontY }}
        className="absolute inset-x-0 -bottom-2 h-48 text-pc-abyss sm:h-64"
      >
        <MountainsFront />
      </motion.div>

      {/* Reflets d'eau : fines traînées lumineuses au pied des montagnes */}
      <div aria-hidden className="absolute inset-x-0 bottom-6 hidden sm:block">
        {[
          "left-[12%] w-40 opacity-25",
          "left-[38%] w-64 opacity-15",
          "right-[18%] w-48 opacity-20",
        ].map((pos, i) => (
          <span
            key={i}
            className={`pc-float absolute h-px bg-gradient-to-r from-transparent via-pc-mist to-transparent ${pos}`}
            style={{ animationDelay: `${i * 1.8}s`, animationDuration: "9s" }}
          />
        ))}
      </div>

      {/* Contenu */}
      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-6 pt-32 pb-28 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10"
      >
        <div className="max-w-xl">
          <motion.p
            {...enter(0.05)}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm"
          >
            <span className="size-1.5 rounded-full bg-pc-turquoise" aria-hidden />
            Conçu en Polynésie française
          </motion.p>
          <motion.h1
            {...enter(0.15)}
            className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-white text-balance sm:text-5xl lg:text-[3.5rem]"
          >
            Gérez vos locations{" "}
            <span className="bg-gradient-to-r from-pc-turquoise to-pc-mist bg-clip-text text-transparent">
              sans perdre votre temps.
            </span>
          </motion.h1>
          <motion.p
            {...enter(0.28)}
            className="mt-6 text-lg leading-relaxed text-white/75"
          >
            Véhicules, matériels ou logements&nbsp;: réservations, clients,
            contrats et paiements réunis dans un seul espace.
          </motion.p>
          <motion.div
            {...enter(0.4)}
            className="mt-9 flex flex-wrap items-center gap-3 sm:gap-4"
          >
            <Link
              href="/#activite"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pc-coral to-[#ff5d54] px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-pc-coral/25 transition hover:brightness-105"
            >
              Découvrir la solution
              <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-full border border-white/25 bg-white/[0.07] px-7 py-3.5 text-base font-medium text-white backdrop-blur-sm transition hover:bg-white/15"
            >
              Voir la démo
            </Link>
          </motion.div>
        </div>

        {/* Aperçu du produit */}
        <motion.div
          initial={{ opacity: 0, y: 48, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.5 }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <div
            aria-hidden
            className="absolute -inset-6 rounded-[2rem] bg-pc-turquoise/10 blur-2xl"
          />
          <DashboardPreview className="relative" />
        </motion.div>
      </motion.div>

      {/* Invitation à scroller. L'opacité du scrub (scroll) vit sur le
          wrapper et celle de l'animation d'entrée sur le lien : les deux se
          composent au lieu de se disputer la même propriété. */}
      <motion.div
        style={{ opacity: contentOpacity }}
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2"
      >
        <motion.a
          href="#activite"
          aria-label="Faire défiler vers la suite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
          className="block text-white/60 transition hover:text-white"
        >
          <span className="pc-bob flex flex-col items-center gap-1">
            <span className="text-[11px] font-medium uppercase tracking-widest">
              Découvrir
            </span>
            <ChevronDown className="size-4" aria-hidden />
          </span>
        </motion.a>
      </motion.div>
    </section>
  );
}
