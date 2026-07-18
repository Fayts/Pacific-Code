"use client";

import { useState } from "react";
import Link from "next/link";
import { Waves } from "lucide-react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { cn } from "@/lib/utils";
import { NavAuthCtas } from "@/components/landing/auth-cta";

const LINKS = [
  { href: "/#activite", label: "Le produit" },
  { href: "/#parcours", label: "Le parcours" },
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/#polynesie", label: "Polynésie" },
];

export function LandingNav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const next = y > 24;
    if (next !== scrolled) setScrolled(next);
  });

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-500",
        scrolled
          ? "border-b border-white/5 bg-pc-night/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 text-white">
          <span className="flex size-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm">
            <Waves className="size-5" aria-hidden />
          </span>
          <span className="whitespace-nowrap text-lg font-semibold tracking-tight">
            Pacific Code
          </span>
        </Link>
        <div className="flex items-center gap-2 lg:gap-6">
          <div className="hidden items-center gap-6 text-sm font-medium text-white/80 lg:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <NavAuthCtas />
        </div>
      </nav>
    </motion.header>
  );
}
