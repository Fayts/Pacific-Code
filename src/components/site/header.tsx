"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Droplets, Menu, UserRound, X } from "lucide-react";
import { ButtonLink, cn } from "@/components/ui";

const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/locations", label: "Locations" },
  { href: "/prestations", label: "Prestations" },
  { href: "/compte", label: "Mon espace" },
];

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-lagoon-400 to-lagoon-600 text-white">
        <Droplets size={19} strokeWidth={2.2} />
      </span>
      <span
        className={cn(
          "text-[17px] font-semibold tracking-tight leading-none",
          dark ? "text-white" : "text-navy-900"
        )}
      >
        Pacific <span className="text-lagoon-500">Rent&Clean</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-mist-200 bg-white/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-mist-100 text-navy-900"
                  : "text-navy-500 hover:text-navy-900"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href="/compte" variant="ghost" size="sm">
            <UserRound size={16} />
            Moana
          </ButtonLink>
          <ButtonLink href="/reservation" variant="accent" size="sm">
            Réserver
          </ButtonLink>
        </div>

        <button
          className="rounded-lg p-2 text-navy-700 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open ? (
        <nav className="border-t border-mist-200 bg-white px-4 py-3 md:hidden">
          {NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block rounded-xl px-4 py-3 text-sm font-medium",
                pathname === link.href
                  ? "bg-mist-100 text-navy-900"
                  : "text-navy-600"
              )}
            >
              {link.label}
            </Link>
          ))}
          <ButtonLink
            href="/reservation"
            variant="accent"
            className="mt-2 w-full"
            onClick={() => setOpen(false)}
          >
            Réserver
          </ButtonLink>
        </nav>
      ) : null}
    </header>
  );
}
