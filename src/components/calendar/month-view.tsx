// Vue mois : grille 7 colonnes (lundi → dimanche), chips des réservations
// couvrant chaque jour local. Sur mobile, les chips deviennent des points
// colorés. Composant serveur.

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { CALENDAR_STATUS_COLORS } from "@/lib/core/labels";
import { cn } from "@/lib/utils";
import type { CalendarDay, CalendarEntry } from "./calendar-data";

const WEEKDAY_LABELS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const MAX_CHIPS = 3;
const MAX_DOTS = 4;

function BookingChip({ entry }: { entry: CalendarEntry }) {
  return (
    <Link
      href={`/bookings/${entry.id}`}
      title={`${entry.bookingNumber} · ${entry.customerName}${
        entry.conflict ? " — Conflit possible" : ""
      }`}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-4 font-medium transition hover:brightness-95",
        CALENDAR_STATUS_COLORS[entry.status],
        entry.conflict && "ring-2 ring-red-500"
      )}
    >
      {entry.conflict && (
        <AlertTriangle className="size-3 shrink-0 text-red-600" aria-hidden />
      )}
      <span className="truncate">
        {entry.bookingNumber} · {entry.customerName}
      </span>
    </Link>
  );
}

export function MonthView({ days }: { days: CalendarDay[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-1 py-1.5 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border">
        {days.map((day) => {
          const hidden = day.entries.length - MAX_CHIPS;
          return (
            <div
              key={day.key}
              className={cn(
                "min-h-14 p-1 sm:min-h-28 sm:p-1.5",
                day.isCurrentMonth ? "bg-card" : "bg-muted/50"
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs",
                    day.isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : day.isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground/70"
                  )}
                >
                  {day.date.day}
                </span>
              </div>

              {/* Desktop / tablette : chips détaillées. */}
              <div className="mt-1 hidden flex-col gap-1 sm:flex">
                {day.entries.slice(0, MAX_CHIPS).map((entry) => (
                  <BookingChip key={entry.id} entry={entry} />
                ))}
                {hidden > 0 && (
                  <span className="px-1.5 text-[11px] text-muted-foreground">
                    +{hidden} {hidden > 1 ? "autres" : "autre"}
                  </span>
                )}
              </div>

              {/* Mobile : points colorés compacts. */}
              <div className="mt-1 flex flex-wrap items-center gap-1 sm:hidden">
                {day.entries.slice(0, MAX_DOTS).map((entry) => (
                  <span
                    key={entry.id}
                    title={`${entry.bookingNumber} · ${entry.customerName}`}
                    className={cn(
                      "size-2 rounded-full",
                      CALENDAR_STATUS_COLORS[entry.status],
                      entry.conflict && "ring-1 ring-red-500"
                    )}
                  />
                ))}
                {day.entries.length > MAX_DOTS && (
                  <span className="text-[10px] leading-none text-muted-foreground">
                    +{day.entries.length - MAX_DOTS}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
