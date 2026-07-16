// Interprétation déterministe d'expressions de dates en français,
// dans le fuseau horaire de l'organisation. Utilisé par le mode démo
// de l'assistant (aucun LLM requis) et testé unitairement.

import {
  dayRangeInTimeZone,
  monthRangeInTimeZone,
  utcToZonedParts,
  zonedTimeToUtc,
} from "@/lib/core/dates";

const WEEKDAYS: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

export type ResolvedPeriod = {
  start: Date;
  end: Date;
  label: string;
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Jour de semaine (0-6) de l'instant donné, dans le fuseau donné. */
function weekdayInTimeZone(date: Date, timeZone: string): number {
  const p = utcToZonedParts(date, timeZone);
  // Zeller-free : reconstruit un Date UTC de midi local pour lire le jour.
  const noonUtc = zonedTimeToUtc(
    { year: p.year, month: p.month, day: p.day, hour: 12, minute: 0 },
    timeZone
  );
  return noonUtc.getUTCDay();
}

function addDaysInTimeZone(date: Date, days: number, timeZone: string): Date {
  const p = utcToZonedParts(date, timeZone);
  return zonedTimeToUtc(
    { year: p.year, month: p.month, day: p.day + days, hour: 12, minute: 0 },
    timeZone
  );
}

/**
 * Résout une expression de période française vers des bornes UTC.
 * Retourne null si aucune expression connue n'est détectée.
 * Expressions gérées : aujourd'hui, demain, après-demain, ce mois-ci,
 * cette semaine, noms de jours (prochaine occurrence, ex. « samedi »).
 */
export function resolvePeriodFr(
  text: string,
  timeZone: string,
  now: Date = new Date()
): ResolvedPeriod | null {
  const t = normalize(text);

  if (/aujourd\s*'?\s*hui/.test(t)) {
    const { start, end } = dayRangeInTimeZone(now, timeZone);
    return { start, end, label: "aujourd'hui" };
  }
  if (/apres[- ]demain/.test(t)) {
    const target = addDaysInTimeZone(now, 2, timeZone);
    const { start, end } = dayRangeInTimeZone(target, timeZone);
    return { start, end, label: "après-demain" };
  }
  if (/\bdemain\b/.test(t)) {
    const target = addDaysInTimeZone(now, 1, timeZone);
    const { start, end } = dayRangeInTimeZone(target, timeZone);
    return { start, end, label: "demain" };
  }
  if (/ce mois|du mois/.test(t)) {
    const { start, end } = monthRangeInTimeZone(now, timeZone);
    return { start, end, label: "ce mois-ci" };
  }
  if (/cette semaine/.test(t)) {
    const today = weekdayInTimeZone(now, timeZone);
    // Semaine courante : lundi → dimanche.
    const sinceMonday = (today + 6) % 7;
    const monday = addDaysInTimeZone(now, -sinceMonday, timeZone);
    const nextMonday = addDaysInTimeZone(now, 7 - sinceMonday, timeZone);
    return {
      start: dayRangeInTimeZone(monday, timeZone).start,
      end: dayRangeInTimeZone(nextMonday, timeZone).start,
      label: "cette semaine",
    };
  }

  for (const [name, weekday] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      const today = weekdayInTimeZone(now, timeZone);
      let delta = (weekday - today + 7) % 7;
      if (delta === 0) delta = 7; // « samedi » un samedi = samedi prochain
      const target = addDaysInTimeZone(now, delta, timeZone);
      const { start, end } = dayRangeInTimeZone(target, timeZone);
      return { start, end, label: name };
    }
  }

  return null;
}
