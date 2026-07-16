import { describe, expect, it } from "vitest";

import {
  dayRangeInTimeZone,
  monthRangeInTimeZone,
  parseLocalDateTimeInput,
  periodsOverlap,
  toLocalDateTimeInput,
} from "@/lib/core/dates";

const TAHITI = "Pacific/Tahiti"; // UTC-10, sans heure d'été
const NEW_YORK = "America/New_York"; // UTC-4 (été) / UTC-5 (hiver)
const AUCKLAND = "Pacific/Auckland"; // UTC+13 (été austral) / UTC+12 (hiver)

describe("parseLocalDateTimeInput", () => {
  it("convertit 08:00 à Tahiti en 18:00 UTC le même jour", () => {
    const date = parseLocalDateTimeInput("2026-07-16T08:00", TAHITI);
    expect(date.toISOString()).toBe("2026-07-16T18:00:00.000Z");
  });

  it("accepte les secondes optionnelles", () => {
    const date = parseLocalDateTimeInput("2026-07-16T08:00:30", TAHITI);
    expect(date.toISOString()).toBe("2026-07-16T18:00:30.000Z");
  });

  it("rejette un format invalide", () => {
    expect(() => parseLocalDateTimeInput("16/07/2026 08:00", TAHITI)).toThrow(
      RangeError
    );
    expect(() => parseLocalDateTimeInput("2026-07-16", TAHITI)).toThrow(
      RangeError
    );
  });
});

describe("toLocalDateTimeInput", () => {
  it("est l'inverse de parseLocalDateTimeInput à Tahiti", () => {
    const utc = new Date("2026-07-16T18:00:00Z");
    expect(toLocalDateTimeInput(utc, TAHITI)).toBe("2026-07-16T08:00");
  });

  it("complète avec des zéros (mois, jour, heure, minute)", () => {
    const utc = parseLocalDateTimeInput("2026-01-05T04:07", TAHITI);
    expect(toLocalDateTimeInput(utc, TAHITI)).toBe("2026-01-05T04:07");
  });
});

describe("round-trip dans des fuseaux à heure d'été", () => {
  const roundTrip = (value: string, timeZone: string) =>
    toLocalDateTimeInput(parseLocalDateTimeInput(value, timeZone), timeZone);

  it("America/New_York en été (EDT, UTC-4)", () => {
    const utc = parseLocalDateTimeInput("2026-07-15T10:00", NEW_YORK);
    expect(utc.toISOString()).toBe("2026-07-15T14:00:00.000Z");
    expect(roundTrip("2026-07-15T10:00", NEW_YORK)).toBe("2026-07-15T10:00");
  });

  it("America/New_York en hiver (EST, UTC-5)", () => {
    const utc = parseLocalDateTimeInput("2026-01-15T10:00", NEW_YORK);
    expect(utc.toISOString()).toBe("2026-01-15T15:00:00.000Z");
    expect(roundTrip("2026-01-15T10:00", NEW_YORK)).toBe("2026-01-15T10:00");
  });

  it("Pacific/Auckland en été austral (NZDT, UTC+13)", () => {
    const utc = parseLocalDateTimeInput("2026-01-15T10:00", AUCKLAND);
    expect(utc.toISOString()).toBe("2026-01-14T21:00:00.000Z");
    expect(roundTrip("2026-01-15T10:00", AUCKLAND)).toBe("2026-01-15T10:00");
  });

  it("Pacific/Auckland en hiver austral (NZST, UTC+12)", () => {
    const utc = parseLocalDateTimeInput("2026-07-15T10:00", AUCKLAND);
    expect(utc.toISOString()).toBe("2026-07-14T22:00:00.000Z");
    expect(roundTrip("2026-07-15T10:00", AUCKLAND)).toBe("2026-07-15T10:00");
  });
});

describe("dayRangeInTimeZone", () => {
  it("borne la journée locale de Tahiti : minuit local = 10:00 UTC", () => {
    // 2026-07-16T01:30Z = 2026-07-15 15:30 heure de Tahiti.
    const { start, end } = dayRangeInTimeZone(
      new Date("2026-07-16T01:30:00Z"),
      TAHITI
    );
    expect(start.toISOString()).toBe("2026-07-15T10:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-16T10:00:00.000Z");
  });

  it("rattache un instant UTC du soir à la bonne journée locale", () => {
    // 2026-07-16T18:00Z = 2026-07-16 08:00 heure de Tahiti.
    const { start, end } = dayRangeInTimeZone(
      new Date("2026-07-16T18:00:00Z"),
      TAHITI
    );
    expect(start.toISOString()).toBe("2026-07-16T10:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-17T10:00:00.000Z");
  });
});

describe("monthRangeInTimeZone", () => {
  it("borne le mois local de Tahiti", () => {
    const { start, end } = monthRangeInTimeZone(
      new Date("2026-07-16T18:00:00Z"),
      TAHITI
    );
    expect(start.toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-01T10:00:00.000Z");
  });

  it("rattache un début de mois UTC au mois local précédent", () => {
    // 2026-07-01T05:00Z = 2026-06-30 19:00 heure de Tahiti → mois de juin.
    const { start, end } = monthRangeInTimeZone(
      new Date("2026-07-01T05:00:00Z"),
      TAHITI
    );
    expect(start.toISOString()).toBe("2026-06-01T10:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-01T10:00:00.000Z");
  });

  it("passe correctement à l'année suivante en décembre", () => {
    const { start, end } = monthRangeInTimeZone(
      new Date("2026-12-15T12:00:00Z"),
      TAHITI
    );
    expect(start.toISOString()).toBe("2026-12-01T10:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T10:00:00.000Z");
  });
});

describe("periodsOverlap", () => {
  const d = (iso: string) => new Date(iso);

  it("détecte un chevauchement partiel", () => {
    expect(
      periodsOverlap(
        d("2026-07-16T08:00:00Z"),
        d("2026-07-18T08:00:00Z"),
        d("2026-07-17T08:00:00Z"),
        d("2026-07-19T08:00:00Z")
      )
    ).toBe(true);
  });

  it("détecte une période contenue dans l'autre", () => {
    expect(
      periodsOverlap(
        d("2026-07-16T08:00:00Z"),
        d("2026-07-20T08:00:00Z"),
        d("2026-07-17T08:00:00Z"),
        d("2026-07-18T08:00:00Z")
      )
    ).toBe(true);
  });

  it("détecte deux périodes identiques", () => {
    expect(
      periodsOverlap(
        d("2026-07-16T08:00:00Z"),
        d("2026-07-18T08:00:00Z"),
        d("2026-07-16T08:00:00Z"),
        d("2026-07-18T08:00:00Z")
      )
    ).toBe(true);
  });

  it("bords exclusifs : fin de A = début de B → pas de chevauchement", () => {
    expect(
      periodsOverlap(
        d("2026-07-16T08:00:00Z"),
        d("2026-07-17T08:00:00Z"),
        d("2026-07-17T08:00:00Z"),
        d("2026-07-18T08:00:00Z")
      )
    ).toBe(false);
    // Et dans l'autre sens : fin de B = début de A.
    expect(
      periodsOverlap(
        d("2026-07-17T08:00:00Z"),
        d("2026-07-18T08:00:00Z"),
        d("2026-07-16T08:00:00Z"),
        d("2026-07-17T08:00:00Z")
      )
    ).toBe(false);
  });

  it("ne détecte rien pour deux périodes disjointes", () => {
    expect(
      periodsOverlap(
        d("2026-07-16T08:00:00Z"),
        d("2026-07-17T08:00:00Z"),
        d("2026-07-20T08:00:00Z"),
        d("2026-07-21T08:00:00Z")
      )
    ).toBe(false);
  });
});
