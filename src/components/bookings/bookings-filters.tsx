"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BOOKING_STATUS } from "@/lib/core/labels";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Tous les statuts" },
  { value: "draft", label: BOOKING_STATUS.draft.label },
  { value: "pending", label: BOOKING_STATUS.pending.label },
  { value: "confirmed", label: BOOKING_STATUS.confirmed.label },
  { value: "in_progress", label: BOOKING_STATUS.in_progress.label },
  { value: "late", label: BOOKING_STATUS.late.label },
  { value: "completed", label: BOOKING_STATUS.completed.label },
  { value: "cancelled", label: BOOKING_STATUS.cancelled.label },
];

const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Toutes les périodes" },
  { value: "upcoming", label: "À venir" },
  { value: "current", label: "En cours" },
  { value: "past", label: "Passées" },
];

// Filtres de la liste des réservations, synchronisés avec l'URL.
export function BookingsFilters({
  status,
  q,
  period,
}: {
  status: string;
  q: string;
  period: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(q);
  const initialRender = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resynchronise le champ quand l'URL change ailleurs (ex. réinitialisation),
  // sans écraser une saisie en cours.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setSearch(q);
    }
  }, [q]);

  const apply = (patch: { status?: string; q?: string; period?: string }) => {
    const next = {
      status: patch.status ?? status,
      q: patch.q ?? search,
      period: patch.period ?? period,
    };
    const params = new URLSearchParams();
    if (next.status && next.status !== "all") params.set("status", next.status);
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.period && next.period !== "all") params.set("period", next.period);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  // Recherche avec debounce (350 ms), sans navigation au premier rendu.
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    const timer = setTimeout(() => apply({ q: search }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
        <Input
          ref={inputRef}
          type="search"
          placeholder="Numéro ou client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
          aria-label="Rechercher une réservation"
        />
      </div>
      <Select
        value={status || "all"}
        onValueChange={(v) => apply({ status: v as string })}
      >
        <SelectTrigger className="w-full sm:w-44" aria-label="Filtrer par statut">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={period || "all"}
        onValueChange={(v) => apply({ period: v as string })}
      >
        <SelectTrigger
          className="w-full sm:w-44"
          aria-label="Filtrer par période"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
