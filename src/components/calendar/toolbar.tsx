"use client";

// Barre d'outils du calendrier : navigation temporelle, bascule mois/semaine
// et filtres (matériel, statut). Pousse les critères dans l'URL.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BOOKING_STATUS } from "@/lib/core/labels";
import type { BookingStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = (
  [
    "draft",
    "pending",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
  ] as BookingStatus[]
).map((value) => ({ value, label: BOOKING_STATUS[value].label }));

type ToolbarProps = {
  view: "month" | "week";
  /** Date de référence courante (yyyy-MM-dd). */
  date: string;
  /** Titre de la période ("Juillet 2026", "Semaine du 13 juillet 2026"). */
  title: string;
  prevDate: string;
  nextDate: string;
  todayDate: string;
  /** "all" ou uuid du matériel filtré. */
  equipmentValue: string;
  /** "all" ou statut filtré. */
  statusValue: string;
  equipmentOptions: { id: string; name: string }[];
};

export function CalendarToolbar({
  view,
  date,
  title,
  prevDate,
  nextDate,
  todayDate,
  equipmentValue,
  statusValue,
  equipmentOptions,
}: ToolbarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navigate = (changes: {
    view?: "month" | "week";
    date?: string;
    equipment?: string;
    status?: string;
  }) => {
    const params = new URLSearchParams();
    params.set("view", changes.view ?? view);
    params.set("date", changes.date ?? date);
    const equipment = changes.equipment ?? equipmentValue;
    const status = changes.status ?? statusValue;
    if (equipment !== "all") params.set("equipment", equipment);
    if (status !== "all") params.set("status", status);
    startTransition(() => {
      router.push(`/calendar?${params.toString()}`);
    });
  };

  const equipmentItems: Record<string, string> = { all: "Tous les matériels" };
  for (const option of equipmentOptions) {
    equipmentItems[option.id] = option.name;
  }
  const statusItems: Record<string, string> = { all: "Tous les statuts" };
  for (const option of STATUS_OPTIONS) {
    statusItems[option.value] = option.label;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Période précédente"
          disabled={pending}
          onClick={() => navigate({ date: prevDate })}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => navigate({ date: todayDate })}
        >
          Aujourd&apos;hui
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Période suivante"
          disabled={pending}
          onClick={() => navigate({ date: nextDate })}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>

      <h2 className="min-w-0 truncate text-base font-semibold text-neutral-900 md:text-lg">
        {title}
      </h2>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Changer de vue"
          className="inline-flex items-center rounded-lg bg-neutral-100 p-0.5"
        >
          <button
            type="button"
            disabled={pending}
            onClick={() => navigate({ view: "month" })}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm transition-colors",
              view === "month"
                ? "bg-white font-medium text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            )}
          >
            Mois
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => navigate({ view: "week" })}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm transition-colors",
              view === "week"
                ? "bg-white font-medium text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            )}
          >
            Semaine
          </button>
        </div>

        <Select
          value={equipmentValue}
          onValueChange={(value) => navigate({ equipment: String(value) })}
          items={equipmentItems}
        >
          <SelectTrigger
            aria-label="Filtrer par matériel"
            className="w-44 bg-white"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les matériels</SelectItem>
            {equipmentOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusValue}
          onValueChange={(value) => navigate({ status: String(value) })}
          items={statusItems}
        >
          <SelectTrigger
            aria-label="Filtrer par statut"
            className="w-40 bg-white"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
