// Vitrine publique d'un loueur : catalogue avec photos, tarifs et contact.
// Composant serveur pur (aucun état) — les données arrivent de la fonction
// SQL publique get_public_storefront (champs sûrs uniquement).

import { Mail, MapPin, Package, Phone, Waves } from "lucide-react";
import { formatMoney, formatPrice } from "@/lib/core/format";
import type { BusinessType, PricingMode } from "@/lib/types/database";

export type StorefrontData = {
  organization: {
    name: string;
    businessType: BusinessType;
    logoUrl: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    currency: string;
    welcome: string | null;
  };
  categories: Array<{ id: string; name: string }>;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    categoryId: string | null;
    dailyPrice: number;
    pricingMode: PricingMode;
    deposit: number;
    photoUrl: string | null;
    minRentalDays: number;
  }>;
};

/** Titre du catalogue adapté à l'activité du loueur. */
const CATALOG_TITLES: Record<BusinessType, string> = {
  equipment: "Notre matériel de location",
  vehicles: "Nos véhicules",
  nautical: "Notre flotte nautique",
  events: "Notre matériel événementiel",
  other: "Notre catalogue",
};

export function StorefrontView({ data }: { data: StorefrontData }) {
  const { organization, categories, items } = data;
  const currency = organization.currency;

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "Autres";
  const grouped = new Map<string, StorefrontData["items"]>();
  for (const item of items) {
    const key = categoryName(item.categoryId);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return (
    <div className="min-h-svh bg-pc-foam">
      {/* En-tête */}
      <header className="bg-gradient-to-br from-pc-night via-pc-deep to-pc-lagoon px-6 py-14 text-white">
        <div className="mx-auto max-w-5xl">
          {organization.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.logoUrl}
              alt=""
              className="size-14 rounded-2xl border border-white/20 object-cover"
            />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm">
              <Waves className="size-6" aria-hidden />
            </span>
          )}
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            {organization.name}
          </h1>
          {organization.welcome && (
            <p className="mt-3 max-w-2xl text-white/85">{organization.welcome}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/75">
            {organization.phone && (
              <a
                href={`tel:${organization.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-1.5 hover:text-white"
              >
                <Phone className="size-3.5" aria-hidden />
                {organization.phone}
              </a>
            )}
            {organization.email && (
              <a
                href={`mailto:${organization.email}`}
                className="inline-flex items-center gap-1.5 hover:text-white"
              >
                <Mail className="size-3.5" aria-hidden />
                {organization.email}
              </a>
            )}
            {organization.address && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden />
                {organization.address}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Catalogue */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {CATALOG_TITLES[organization.businessType] ?? CATALOG_TITLES.other}
        </h2>

        {items.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Le catalogue arrive bientôt — contactez-nous pour connaître nos
            disponibilités.
          </p>
        ) : (
          [...grouped.entries()].map(([category, categoryItems]) => (
            <section key={category} className="mt-8">
              <h3 className="text-sm font-semibold tracking-wide text-pc-lagoon uppercase">
                {category}
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categoryItems.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]"
                  >
                    {item.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.photoUrl}
                        alt={item.name}
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-pc-foam to-pc-turquoise/10">
                        <Package
                          className="size-10 text-pc-lagoon/30"
                          aria-hidden
                        />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      <h4 className="font-semibold text-foreground">
                        {item.name}
                      </h4>
                      {item.description && (
                        <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-baseline justify-between gap-2">
                        <p className="text-lg font-bold text-pc-lagoon">
                          {formatPrice(item.dailyPrice, currency, item.pricingMode)}
                        </p>
                        {item.deposit > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Caution {formatMoney(item.deposit, currency)}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}

        {/* Contact */}
        <section className="mt-12 rounded-2xl bg-gradient-to-br from-pc-night via-pc-deep to-pc-lagoon p-8 text-center text-white">
          <h3 className="text-lg font-semibold">Envie de réserver ?</h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-white/80">
            La réservation en ligne arrive bientôt — en attendant,
            contactez-nous et nous bloquons vos dates immédiatement.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {organization.phone && (
              <a
                href={`tel:${organization.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-pc-deep transition hover:brightness-95"
              >
                <Phone className="size-4" aria-hidden />
                Appeler
              </a>
            )}
            {organization.email && (
              <a
                href={`mailto:${organization.email}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                <Mail className="size-4" aria-hidden />
                Écrire
              </a>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-pc-deep/10 py-6 text-center text-xs text-muted-foreground">
        Vitrine propulsée par Pacific Code — conçu en Polynésie française
      </footer>
    </div>
  );
}
