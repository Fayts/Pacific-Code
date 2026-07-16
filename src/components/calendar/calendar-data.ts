// Préparation des données du calendrier : dates de calendrier « pures »
// (sans heure ni fuseau), construction de la grille de jours locaux,
// affectation des réservations aux jours et détection de conflits.
// Fonctions pures, exécutées côté serveur.

import { isBlockingStatus } from "@/lib/core/booking-status";
import {
  periodsOverlap,
  utcToZonedParts,
  zonedTimeToUtc,
} from "@/lib/core/dates";
import { formatCustomerName, formatTime } from "@/lib/core/format";
import {
  derivedBookingStatus,
  type DerivedBookingStatus,
} from "@/lib/core/labels";
import type { Booking, Customer } from "@/lib/types/database";

export type CalendarView = "month" | "week";

/** Date de calendrier « pure » (année/mois/jour, sans heure ni fuseau). */
export type LocalDate = { year: number; month: number; day: number };

/** Réservation chargée pour le calendrier (avec client et lignes de matériel). */
export type CalendarBooking = Booking & {
  customers: Pick<
    Customer,
    "type" | "first_name" | "last_name" | "company_name"
  > | null;
  booking_items: {
    equipment_id: string;
    quantity: number;
    equipment_items: { name: string } | null;
  }[];
};

/** Réservation prête à afficher dans une case du calendrier. */
export type CalendarEntry = {
  id: string;
  bookingNumber: string;
  customerName: string;
  status: DerivedBookingStatus;
  conflict: boolean;
  /** Heure de départ/retour dans le fuseau de l'organisation. */
  startTime: string;
  endTime: string;
};

export type CalendarDay = {
  key: string; // yyyy-MM-dd
  date: LocalDate;
  isToday: boolean;
  isCurrentMonth: boolean;
  entries: CalendarEntry[];
};

const DAY_MS = 86_400_000;

/** Représentation numérique d'une date pure (minuit UTC de la date). */
export function localDateToMs(date: LocalDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

export function msToLocalDate(ms: number): LocalDate {
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

export function addDays(date: LocalDate, amount: number): LocalDate {
  return msToLocalDate(localDateToMs(date) + amount * DAY_MS);
}

/** Clé "yyyy-MM-dd" (aussi utilisée dans l'URL). */
export function localDateKey(date: LocalDate): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/** Parse le paramètre ?date=yyyy-MM-dd ; null si absent ou invalide. */
export function parseDateParam(value: string | undefined): LocalDate | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const parsed: LocalDate = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  // Rejette les dates impossibles (ex. 2026-02-31) via normalisation.
  const normalized = msToLocalDate(localDateToMs(parsed));
  return normalized.year === parsed.year &&
    normalized.month === parsed.month &&
    normalized.day === parsed.day
    ? parsed
    : null;
}

/** Index du jour dans la semaine française : lundi = 0 … dimanche = 6. */
function mondayIndex(date: LocalDate): number {
  return (new Date(localDateToMs(date)).getUTCDay() + 6) % 7;
}

export function mondayOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -mondayIndex(date));
}

/** Date du jour dans le fuseau de l'organisation. */
export function todayInTimeZone(timeZone: string): LocalDate {
  const parts = utcToZonedParts(new Date(), timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

export type CalendarGrid = {
  gridStart: LocalDate;
  dayCount: number;
  /**
   * Bornes UTC des jours locaux : dayStartsUtc[i] = début du jour i,
   * dayStartsUtc[dayCount] = fin de la plage visible.
   */
  dayStartsUtc: Date[];
};

/**
 * Grille visible : mois = du lundi de la semaine du 1er au dimanche de la
 * dernière semaine du mois ; semaine = lundi → dimanche.
 */
export function buildCalendarGrid(
  view: CalendarView,
  reference: LocalDate,
  timeZone: string
): CalendarGrid {
  let gridStart: LocalDate;
  let dayCount: number;

  if (view === "week") {
    gridStart = mondayOfWeek(reference);
    dayCount = 7;
  } else {
    const firstOfMonth: LocalDate = {
      year: reference.year,
      month: reference.month,
      day: 1,
    };
    const offset = mondayIndex(firstOfMonth);
    gridStart = addDays(firstOfMonth, -offset);
    const daysInMonth = new Date(
      Date.UTC(reference.year, reference.month, 0)
    ).getUTCDate();
    dayCount = Math.ceil((offset + daysInMonth) / 7) * 7;
  }

  const dayStartsUtc = Array.from({ length: dayCount + 1 }, (_, i) => {
    const day = addDays(gridStart, i);
    return zonedTimeToUtc(
      { year: day.year, month: day.month, day: day.day, hour: 0, minute: 0 },
      timeZone
    );
  });

  return { gridStart, dayCount, dayStartsUtc };
}

/**
 * Conflits potentiels (simplification assumée) : pour chaque matériel, deux
 * réservations bloquantes (à confirmer / confirmée / en cours) qui se
 * chevauchent et dont la somme des quantités dépasse la quantité totale.
 */
export function computeConflictBookingIds(
  bookings: CalendarBooking[],
  quantityTotals: Map<string, number>
): Set<string> {
  const conflicts = new Set<string>();

  const byEquipment = new Map<
    string,
    { bookingId: string; quantity: number; start: Date; end: Date }[]
  >();
  for (const booking of bookings) {
    if (!isBlockingStatus(booking.status)) continue;
    const start = new Date(booking.start_at);
    const end = new Date(booking.end_at);
    for (const item of booking.booking_items) {
      const usages = byEquipment.get(item.equipment_id) ?? [];
      usages.push({
        bookingId: booking.id,
        quantity: item.quantity,
        start,
        end,
      });
      byEquipment.set(item.equipment_id, usages);
    }
  }

  for (const [equipmentId, usages] of byEquipment) {
    const total = quantityTotals.get(equipmentId);
    if (total === undefined) continue; // matériel archivé ou inconnu
    for (let i = 0; i < usages.length; i++) {
      for (let j = i + 1; j < usages.length; j++) {
        const a = usages[i];
        const b = usages[j];
        if (a.bookingId === b.bookingId) continue;
        if (
          periodsOverlap(a.start, a.end, b.start, b.end) &&
          a.quantity + b.quantity > total
        ) {
          conflicts.add(a.bookingId);
          conflicts.add(b.bookingId);
        }
      }
    }
  }

  return conflicts;
}

/**
 * Répartit les réservations sur les jours locaux de la grille : une
 * réservation apparaît dans chaque jour local (fuseau org) qu'elle couvre.
 */
export function buildCalendarDays(options: {
  grid: CalendarGrid;
  bookings: CalendarBooking[];
  conflictIds: Set<string>;
  timeZone: string;
  today: LocalDate;
  /** Mois affiché (vue mois) ; null en vue semaine (tous les jours « courants »). */
  currentMonth: { year: number; month: number } | null;
  now?: Date;
}): CalendarDay[] {
  const { grid, bookings, conflictIds, timeZone, today, currentMonth } =
    options;
  const now = options.now ?? new Date();
  const todayKey = localDateKey(today);
  const gridStartMs = localDateToMs(grid.gridStart);

  const days: CalendarDay[] = Array.from({ length: grid.dayCount }, (_, i) => {
    const date = addDays(grid.gridStart, i);
    return {
      key: localDateKey(date),
      date,
      isToday: localDateKey(date) === todayKey,
      isCurrentMonth: currentMonth
        ? date.year === currentMonth.year && date.month === currentMonth.month
        : true,
      entries: [],
    };
  });

  // La requête trie par start_at ; on retrie par sécurité (ISO comparable).
  const sorted = [...bookings].sort((a, b) =>
    a.start_at.localeCompare(b.start_at)
  );

  for (const booking of sorted) {
    const start = new Date(booking.start_at);
    const end = new Date(booking.end_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

    // Premier et dernier jour local couverts (fin exclusive : une réservation
    // se terminant à minuit pile n'occupe pas le jour suivant).
    const startParts = utcToZonedParts(start, timeZone);
    const endParts = utcToZonedParts(new Date(end.getTime() - 1), timeZone);
    const firstIndex =
      (Date.UTC(startParts.year, startParts.month - 1, startParts.day) -
        gridStartMs) /
      DAY_MS;
    const lastIndex =
      (Date.UTC(endParts.year, endParts.month - 1, endParts.day) -
        gridStartMs) /
      DAY_MS;

    const entry: CalendarEntry = {
      id: booking.id,
      bookingNumber: booking.booking_number,
      customerName: booking.customers
        ? formatCustomerName(booking.customers)
        : "Client sans nom",
      status: derivedBookingStatus(booking.status, end, now),
      conflict: conflictIds.has(booking.id),
      startTime: formatTime(start, timeZone),
      endTime: formatTime(end, timeZone),
    };

    const from = Math.max(0, firstIndex);
    const to = Math.min(grid.dayCount - 1, lastIndex);
    for (let i = from; i <= to; i++) {
      days[i].entries.push(entry);
    }
  }

  return days;
}
