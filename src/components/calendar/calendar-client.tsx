"use client";

// Calendrier des réservations branché sur la couche de données (mode
// mock) : vue mois ou semaine dans le fuseau de l'organisation, filtres
// par matériel et par statut. Reprend la logique de l'ancienne version
// serveur (grille, conflits, répartition par jour local).

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppData } from "@/components/providers/app-data-provider";
import type { BookingWithRelations } from "@/lib/data/repositories";
import type { BookingStatus, EquipmentItem } from "@/lib/types/database";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarLegend } from "@/components/calendar/legend";
import { CalendarToolbar } from "@/components/calendar/toolbar";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import {
  addDays,
  buildCalendarDays,
  buildCalendarGrid,
  computeConflictBookingIds,
  localDateKey,
  localDateToMs,
  mondayOfWeek,
  msToLocalDate,
  parseDateParam,
  todayInTimeZone,
  type CalendarBooking,
  type CalendarView,
} from "@/components/calendar/calendar-data";
import CalendarLoading from "@/app/(app)/calendar/loading";

const FILTERABLE_STATUSES: BookingStatus[] = [
  "draft",
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

const MONTH_TITLE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const WEEK_TITLE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Adapte une réservation du repository au format attendu par le calendrier. */
function toCalendarBooking(booking: BookingWithRelations): CalendarBooking {
  return {
    ...booking,
    customers: booking.customer,
    booking_items: booking.items.map((item) => ({
      equipment_id: item.equipment_id,
      quantity: item.quantity,
      equipment_items: item.equipment ? { name: item.equipment.name } : null,
    })),
  };
}

type CalendarData = {
  bookings: BookingWithRelations[];
  equipment: EquipmentItem[];
};

export function CalendarClient() {
  const { provider, organization, version } = useAppData();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CalendarData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([provider.bookings.list(), provider.equipment.list()]).then(
      ([bookings, equipment]) => {
        if (!cancelled) setData({ bookings, equipment });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [provider, version]);

  if (!data || !organization) {
    return <CalendarLoading />;
  }

  const timeZone = organization.timezone;

  // Critères d'affichage depuis l'URL.
  const view: CalendarView =
    searchParams.get("view") === "week" ? "week" : "month";
  const today = todayInTimeZone(timeZone);
  const refDate = parseDateParam(searchParams.get("date") ?? undefined) ?? today;
  const equipmentParam = searchParams.get("equipment");
  const statusParam = searchParams.get("status");
  const statusFilter = FILTERABLE_STATUSES.includes(
    statusParam as BookingStatus
  )
    ? (statusParam as BookingStatus)
    : null;

  // Plage visible en UTC (jours locaux de l'organisation).
  const grid = buildCalendarGrid(view, refDate, timeZone);
  const startIso = grid.dayStartsUtc[0].toISOString();
  const endIso = grid.dayStartsUtc[grid.dayCount].toISOString();

  const equipment = data.equipment;

  const bookings = data.bookings
    .filter((b) => b.start_at < endIso && b.end_at > startIso)
    .filter((b) => !statusFilter || b.status === statusFilter)
    .map(toCalendarBooking);

  const equipmentValue =
    equipmentParam && equipment.some((item) => item.id === equipmentParam)
      ? equipmentParam
      : "all";

  // Conflits calculés sur toutes les réservations de la période (avant le
  // filtre matériel) pour ne pas masquer un chevauchement.
  const conflictIds = computeConflictBookingIds(
    bookings,
    new Map(equipment.map((item) => [item.id, item.quantity_total]))
  );

  const visibleBookings =
    equipmentValue === "all"
      ? bookings
      : bookings.filter((booking) =>
          booking.booking_items.some(
            (item) => item.equipment_id === equipmentValue
          )
        );

  const days = buildCalendarDays({
    grid,
    bookings: visibleBookings,
    conflictIds,
    timeZone,
    today,
    currentMonth:
      view === "month" ? { year: refDate.year, month: refDate.month } : null,
  });

  // Titre et cibles de navigation (précédent / aujourd'hui / suivant).
  let title: string;
  let prevDate: string;
  let nextDate: string;
  if (view === "month") {
    title = capitalize(
      MONTH_TITLE_FORMATTER.format(
        new Date(Date.UTC(refDate.year, refDate.month - 1, 1))
      )
    );
    prevDate = localDateKey(
      msToLocalDate(Date.UTC(refDate.year, refDate.month - 2, 1))
    );
    nextDate = localDateKey(
      msToLocalDate(Date.UTC(refDate.year, refDate.month, 1))
    );
  } else {
    const monday = mondayOfWeek(refDate);
    title = `Semaine du ${WEEK_TITLE_FORMATTER.format(
      new Date(localDateToMs(monday))
    )}`;
    prevDate = localDateKey(addDays(monday, -7));
    nextDate = localDateKey(addDays(monday, 7));
  }

  const hasConflicts = visibleBookings.some((booking) =>
    conflictIds.has(booking.id)
  );

  return (
    <div>
      <PageHeader
        title="Calendrier"
        description="Planning des réservations dans le fuseau de votre organisation"
      />

      <div className="space-y-4">
        <CalendarToolbar
          view={view}
          date={localDateKey(refDate)}
          title={title}
          prevDate={prevDate}
          nextDate={nextDate}
          todayDate={localDateKey(today)}
          equipmentValue={equipmentValue}
          statusValue={statusFilter ?? "all"}
          equipmentOptions={equipment.map((item) => ({
            id: item.id,
            name: item.name,
          }))}
        />

        {visibleBookings.length === 0 && (
          <p className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500">
            Aucune réservation sur cette période.
          </p>
        )}

        {view === "month" ? <MonthView days={days} /> : <WeekView days={days} />}

        <CalendarLegend hasConflicts={hasConflicts} />
      </div>
    </div>
  );
}
