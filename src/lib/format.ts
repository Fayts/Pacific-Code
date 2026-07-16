export const TIMEZONE = "Pacific/Tahiti";

/** Formate un montant en francs pacifiques : « 12 500 XPF » */
export function formatXPF(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} XPF`;
}

/** Formate une date ISO en français, fuseau Pacific/Tahiti */
export function formatDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  }).format(new Date(`${iso.length === 10 ? `${iso}T12:00:00` : iso}Z`));
}

/** Version courte : « 12 mars 2026 » -> « 12/03/2026 » */
export function formatDateShort(iso: string): string {
  return formatDate(iso, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
