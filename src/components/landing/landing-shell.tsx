"use client";

import { MotionConfig } from "motion/react";

// Respecte automatiquement prefers-reduced-motion pour toutes les
// animations motion de la landing.
export function LandingShell({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
