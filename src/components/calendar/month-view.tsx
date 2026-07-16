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
        "flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-4 font-medium transition-opacity hover:opacity-80",
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
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-1 py-1.5 text-center text-xs font-medium text-neutral-500"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-neutral-200">
        {days.map((day) => {
          const hidden = day.entries.length - MAX_CHIPS;
          return (
            <div
              key={day.key}
              className={cn(
                "min-h-14 p-1 sm:min-h-28 sm:p-1.5",
                day.isCurrentMonth ? "bg-white" : "bg-neutral-50"
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs",
                    day.isToday
                      ? "bg-sky-700 font-semibold text-white"
                      : day.isCurrentMonth
                        ? "text-neutral-700"
                        : "text-neutral-400"
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
                  <span className="px-1.5 text-[11px] text-neutral-500">
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
                  <span className="text-[10px] leading-none text-neutral-500">
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
