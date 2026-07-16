"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  Droplets,
  ExternalLink,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  Sparkles,
  Truck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/calendrier", label: "Calendrier", icon: CalendarDays },
  { href: "/admin/reservations", label: "Réservations", icon: ClipboardList },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/produits", label: "Produits (locations)", icon: Package },
  { href: "/admin/prestations", label: "Prestations", icon: Sparkles },
  { href: "/admin/paiements", label: "Paiements", icon: CreditCard },
  { href: "/admin/livraisons", label: "Livraisons", icon: Truck },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-lagoon-500/15 text-lagoon-300"
                : "text-navy-300 hover:bg-white/5 hover:text-white"
            )}
          >
            <link.icon size={17} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarHeader() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 px-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-lagoon-400 to-lagoon-600 text-white">
        <Droplets size={19} strokeWidth={2.2} />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold text-white">
          Pacific Rent&Clean
        </span>
        <span className="block text-[11px] font-medium uppercase tracking-wider text-lagoon-400">
          Administration
        </span>
      </span>
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-mist-100">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-navy-950 p-4 lg:flex">
        <SidebarHeader />
        <div className="mt-8 flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-navy-300 hover:bg-white/5 hover:text-white"
        >
          <ExternalLink size={16} />
          Voir le site client
        </Link>
        <div className="mt-2 rounded-xl bg-white/5 p-3 text-xs text-navy-300">
          Espace de démonstration — données fictives, aucune action réelle.
        </div>
      </aside>

      {/* Barre mobile */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-navy-950 px-4 lg:hidden">
        <SidebarHeader />
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg p-2 text-white"
          aria-label="Menu admin"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-30 bg-navy-950 px-4 pt-20 pb-6 lg:hidden">
          <NavLinks onNavigate={() => setOpen(false)} />
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="mt-4 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-navy-300"
          >
            <ExternalLink size={16} />
            Voir le site client
          </Link>
        </div>
      ) : null}

      {/* Contenu */}
      <main className="min-w-0 flex-1 px-4 pt-20 pb-12 sm:px-6 lg:ml-64 lg:pt-8">
        {children}
      </main>
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-navy-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
