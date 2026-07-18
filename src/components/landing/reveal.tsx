"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

// Apparition standard au scroll : fondu + léger déplacement vertical.
export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-12% 0px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

// En-tête de section : surtitre, titre, texte d'introduction.
export function SectionHeading({
  eyebrow,
  title,
  lead,
  dark = false,
  className,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <Reveal className={cn("mx-auto max-w-2xl text-center", className)}>
      {eyebrow && (
        <p
          className={cn(
            "text-sm font-semibold uppercase tracking-widest",
            dark ? "text-pc-turquoise" : "text-pc-lagoon"
          )}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={cn(
          "mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl",
          dark ? "text-white" : "text-neutral-900"
        )}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={cn(
            "mt-4 text-lg leading-relaxed",
            dark ? "text-white/70" : "text-neutral-600"
          )}
        >
          {lead}
        </p>
      )}
    </Reveal>
  );
}

export { EASE };
