// Légende des couleurs du calendrier : une pastille par statut (y compris
// « En retard », statut dérivé) et, le cas échéant, la note de conflit.

import { AlertTriangle } from "lucide-react";
import {
  BOOKING_STATUS,
  CALENDAR_STATUS_COLORS,
  type DerivedBookingStatus,
} from "@/lib/core/labels";
import { cn } from "@/lib/utils";

const LEGEND_ORDER: DerivedBookingStatus[] = [
  "draft",
  "pending",
  "confirmed",
  "in_progress",
  "late",
  "completed",
  "cancelled",
];

export function CalendarLegend({ hasConflicts }: { hasConflicts: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-600">
      {LEGEND_ORDER.map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              CALENDAR_STATUS_COLORS[status]
            )}
            aria-hidden
          />
          {BOOKING_STATUS[status].label}
        </span>
      ))}
      {hasConflicts && (
        <span className="flex items-center gap-1.5 font-medium text-red-600">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          Conflit possible (quantités demandées supérieures au stock)
        </span>
      )}
    </div>
  );
}
