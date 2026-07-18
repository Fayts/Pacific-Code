"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Waves } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { WaveLines } from "@/components/landing/decor";

export function SidebarNavList({
  onNavigate,
  layoutId,
}: {
  onNavigate?: () => void;
  layoutId: string;
}) {
  const pathname = usePathname();

  return (
    <ul className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href} className="relative">
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-lg bg-sidebar-accent"
                aria-hidden
              />
            )}
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
                active
                  ? "text-white"
                  : "text-sidebar-foreground/60 hover:bg-white/[0.04] hover:text-sidebar-foreground"
              )}
            >
              {active && (
                <span
                  className="absolute left-0 h-4 w-0.5 rounded-full bg-pc-turquoise"
                  aria-hidden
                />
              )}
              <item.icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active && "text-pc-turquoise"
                )}
                aria-hidden
              />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SidebarBrand({
  organizationName,
}: {
  organizationName: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-turquoise/20">
        <Waves className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight text-white">
          {organizationName}
        </p>
        <p className="text-[11px] leading-tight text-sidebar-foreground/50">
          Pacific Code
        </p>
      </div>
    </div>
  );
}

export function Sidebar({ organizationName }: { organizationName: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <SidebarBrand organizationName={organizationName} />
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <SidebarNavList layoutId="sidebar-active" />
      </nav>
      {/* Signature discrète en pied de barre */}
      <div className="relative px-4 pb-4 pt-6">
        <WaveLines className="absolute inset-x-3 top-0 h-5 text-pc-turquoise/25" />
        <p className="text-[10px] text-sidebar-foreground/35">
          Conçu en Polynésie française
        </p>
      </div>
    </aside>
  );
}
