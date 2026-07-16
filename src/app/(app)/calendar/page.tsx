// Calendrier des réservations : vue mois ou semaine dans le fuseau de
// l'organisation, filtres par matériel et par statut.

import type { Metadata } from "next";
import { requireOrgContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
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
import type { BookingStatus } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Calendrier",
};

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

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await requireOrgContext();
  const timeZone = ctx.organization.timezone;

  // Critères d'affichage depuis l'URL.
  const view: CalendarView = firstValue(sp.view) === "week" ? "week" : "month";
  const today = todayInTimeZone(timeZone);
  const refDate = parseDateParam(firstValue(sp.date)) ?? today;
  const equipmentParam = firstValue(sp.equipment);
  const statusParam = firstValue(sp.status);
  const statusFilter = FILTERABLE_STATUSES.includes(
    statusParam as BookingStatus
  )
    ? (statusParam as BookingStatus)
    : null;

  // Plage visible en UTC (jours locaux de l'organisation).
  const grid = buildCalendarGrid(view, refDate, timeZone);
  const startIso = grid.dayStartsUtc[0].toISOString();
  const endIso = grid.dayStartsUtc[grid.dayCount].toISOString();

  const supabase = await createClient();

  let bookingsQuery = supabase
    .from("bookings")
    .select(
      "*, customers(type, first_name, last_name, company_name), booking_items(equipment_id, quantity, equipment_items(name))"
    )
    .eq("organization_id", ctx.organization.id)
    .lt("start_at", endIso)
    .gt("end_at", startIso)
    .order("start_at", { ascending: true });
  if (statusFilter) {
    bookingsQuery = bookingsQuery.eq("status", statusFilter);
  }

  const [{ data: bookingsData }, { data: equipmentData }] = await Promise.all([
    bookingsQuery,
    supabase
      .from("equipment_items")
      .select("id, name, quantity_total")
      .eq("organization_id", ctx.organization.id)
      .is("archived_at", null)
      .order("name", { ascending: true }),
  ]);

  const bookings = (bookingsData ?? []) as CalendarBooking[];
  const equipment = equipmentData ?? [];

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
