// Utilitaires liés à l'organisation.

/**
 * Préfixe de numérotation suggéré à partir du nom commercial.
 * "Pacific Rent&Clean" → "PRC" ; repli sur "RES" si rien d'exploitable.
 */
export function deriveBookingPrefix(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const words = normalized.split(/[^A-Za-z0-9]+/).filter(Boolean);

  let prefix = words
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .replace(/[^A-Z0-9]/g, "");

  if (prefix.length < 2) {
    prefix = normalized
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 3);
  }

  prefix = prefix.slice(0, 6);
  return /^[A-Z0-9]{2,6}$/.test(prefix) ? prefix : "RES";
}

export const CURRENCY_OPTIONS = [
  { value: "XPF", label: "XPF — Franc pacifique" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "USD", label: "USD — Dollar américain" },
  { value: "NZD", label: "NZD — Dollar néo-zélandais" },
  { value: "AUD", label: "AUD — Dollar australien" },
];

export const TIMEZONE_OPTIONS = [
  { value: "Pacific/Tahiti", label: "Pacific/Tahiti (UTC-10)" },
  { value: "Pacific/Marquesas", label: "Pacific/Marquesas (UTC-9:30)" },
  { value: "Pacific/Gambier", label: "Pacific/Gambier (UTC-9)" },
  { value: "Pacific/Noumea", label: "Pacific/Nouméa (UTC+11)" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "America/Guadeloupe", label: "America/Guadeloupe" },
  { value: "Indian/Reunion", label: "Indian/Réunion" },
];
