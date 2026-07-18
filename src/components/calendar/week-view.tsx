// Vue semaine : 7 colonnes (lundi → dimanche) sur desktop, liste verticale
// par jour sur mobile. Chaque réservation est un bloc avec les heures de
// départ et de retour. Composant serveur.

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { CALENDAR_STATUS_COLORS } from "@/lib/core/labels";
import { cn } from "@/lib/utils";
import type { CalendarDay, CalendarEntry } from "./calendar-data";

const WEEKDAY_LABELS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function dayLabel(day: CalendarDay): string {
  return DAY_LABEL_FORMATTER.format(
    new Date(Date.UTC(day.date.year, day.date.month - 1, day.date.day))
  );
}

function BookingBlock({ entry }: { entry: CalendarEntry }) {
  return (
    <Link
      href={`/bookings/${entry.id}`}
      title={`${entry.bookingNumber} · ${entry.customerName}${
        entry.conflict ? " — Conflit possible" : ""
      }`}
      className={cn(
        "block min-w-0 rounded-md px-2 py-1.5 text-xs transition hover:brightness-95",
        CALENDAR_STATUS_COLORS[entry.status],
        entry.conflict && "ring-2 ring-red-500"
      )}
    >
      <span className="flex items-center gap-1 font-semibold">
        {entry.conflict && (
          <AlertTriangle className="size-3 shrink-0 text-red-600" aria-hidden />
        )}
        <span className="truncate">{entry.bookingNumber}</span>
      </span>
      <span className="mt-0.5 block truncate">{entry.customerName}</span>
      <span className="mt-0.5 block text-[11px] opacity-80">
        {entry.startTime} → {entry.endTime}
      </span>
    </Link>
  );
}

export function WeekView({ days }: { days: CalendarDay[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
      <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-7">
        {days.map((day, index) => (
          <section key={day.key} className="bg-card">
            <header
              className={cn(
                "flex items-center gap-2 border-b border-border px-3 py-2 md:flex-col md:items-center md:gap-0.5",
                day.isToday && "bg-primary/[0.06]"
              )}
            >
              <span className="text-xs font-medium text-muted-foreground">
                {WEEKDAY_LABELS[index % 7]}
              </span>
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-sm font-semibold",
                  day.isToday
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                )}
              >
                {dayLabel(day)}
              </span>
            </header>

            <div className="flex min-h-16 flex-col gap-1.5 p-2 md:min-h-72">
              {day.entries.length === 0 ? (
                <p className="px-1 py-0.5 text-xs text-muted-foreground/70">
                  Aucune réservation
                </p>
              ) : (
                day.entries.map((entry) => (
                  <BookingBlock key={entry.id} entry={entry} />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
