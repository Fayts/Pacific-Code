"use client";

import { useEffect, type RefObject } from "react";
import { useMotionValue, type MotionValue } from "motion/react";

// Progression de scroll d'une section, calculée à la main : déterministe et
// identique sur tous les navigateurs (les timelines natives de useScroll
// donnent des valeurs incohérentes sur les sections sticky).
//
// mode "contain" : 0 quand le haut de la section touche le haut du viewport,
//                  1 quand son bas touche le bas (sections sticky).
// mode "exit"    : 0 tant que la section est en haut, 1 quand elle est
//                  entièrement sortie par le haut (héro).
export function useSectionProgress(
  ref: RefObject<HTMLElement | null>,
  mode: "contain" | "exit" = "contain"
): MotionValue<number> {
  const progress = useMotionValue(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total =
        mode === "contain"
          ? el.offsetHeight - window.innerHeight
          : el.offsetHeight;
      if (total <= 0) return;
      progress.set(Math.min(1, Math.max(0, -rect.top / total)));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref, mode, progress]);

  return progress;
}
