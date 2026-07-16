// Formatage monétaire et temporel, en français, dans le fuseau de l'organisation.

const ZERO_DECIMAL_CURRENCIES = new Set(["XPF", "XOF", "XAF", "JPY", "KRW", "VND"]);

export function formatMoney(amount: number, currency: string = "XPF"): string {
  const digits = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    // Devise inconnue de l'environnement : repli lisible.
    return `${new Intl.NumberFormat("fr-FR").format(amount)} ${currency}`;
  }
}

export function formatDate(
  date: Date | string,
  timeZone: string = "Pacific/Tahiti"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(d);
}

export function formatDateLong(
  date: Date | string,
  timeZone: string = "Pacific/Tahiti"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(d);
}

export function formatTime(
  date: Date | string,
  timeZone: string = "Pacific/Tahiti"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

export function formatDateTime(
  date: Date | string,
  timeZone: string = "Pacific/Tahiti"
): string {
  return `${formatDate(date, timeZone)} à ${formatTime(date, timeZone)}`;
}

/** "Jean" + "Dupont" → "Jean Dupont" ; société → nom de société. */
export function formatCustomerName(customer: {
  type?: "individual" | "company" | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
}): string {
  if (customer.type === "company" && customer.company_name) {
    return customer.company_name;
  }
  const full = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || customer.company_name || "Client sans nom";
}

export function formatInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
