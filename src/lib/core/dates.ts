// Manipulation de dates avec fuseau horaire d'organisation (ex. Pacific/Tahiti).
// Les instants sont stockés en UTC (timestamptz) ; l'affichage et la saisie
// se font dans le fuseau de l'organisation. Aucune dépendance externe :
// Intl couvre les conversions, date-fns reste disponible pour l'arithmétique.

export type DateParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Décompose un instant UTC en parties locales dans un fuseau donné. */
export function utcToZonedParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Intl peut renvoyer "24" pour minuit selon les moteurs.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * Convertit une date/heure locale d'un fuseau donné en instant UTC.
 * Double passe pour rester correct dans les fuseaux à heure d'été
 * (Pacific/Tahiti est fixe UTC-10, mais la fonction reste générique).
 */
export function zonedTimeToUtc(parts: Omit<DateParts, "second"> & { second?: number }, timeZone: string): Date {
  const { year, month, day, hour, minute } = parts;
  const second = parts.second ?? 0;
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second);

  let guess = naiveUtc;
  for (let i = 0; i < 2; i++) {
    const local = utcToZonedParts(new Date(guess), timeZone);
    const localAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second
    );
    guess += naiveUtc - localAsUtc;
  }
  return new Date(guess);
}

/** Parse une valeur d'input datetime-local ("2026-07-16T08:00") vers un instant UTC. */
export function parseLocalDateTimeInput(value: string, timeZone: string): Date {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match) {
    throw new RangeError(`Date invalide : ${value}`);
  }
  return zonedTimeToUtc(
    {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5]),
      second: match[6] ? Number(match[6]) : 0,
    },
    timeZone
  );
}

/** Formate un instant UTC en valeur d'input datetime-local dans le fuseau donné. */
export function toLocalDateTimeInput(date: Date, timeZone: string): string {
  const p = utcToZonedParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Bornes UTC de la journée locale contenant l'instant donné. */
export function dayRangeInTimeZone(
  date: Date,
  timeZone: string
): { start: Date; end: Date } {
  const p = utcToZonedParts(date, timeZone);
  const start = zonedTimeToUtc(
    { year: p.year, month: p.month, day: p.day, hour: 0, minute: 0 },
    timeZone
  );
  const end = zonedTimeToUtc(
    { year: p.year, month: p.month, day: p.day + 1, hour: 0, minute: 0 },
    timeZone
  );
  return { start, end };
}

/** Bornes UTC du mois local contenant l'instant donné. */
export function monthRangeInTimeZone(
  date: Date,
  timeZone: string
): { start: Date; end: Date } {
  const p = utcToZonedParts(date, timeZone);
  const start = zonedTimeToUtc(
    { year: p.year, month: p.month, day: 1, hour: 0, minute: 0 },
    timeZone
  );
  const end = zonedTimeToUtc(
    { year: p.year, month: p.month + 1, day: 1, hour: 0, minute: 0 },
    timeZone
  );
  return { start, end };
}

/** Deux périodes [aStart, aEnd) et [bStart, bEnd) se chevauchent-elles ? */
export function periodsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart;
}
