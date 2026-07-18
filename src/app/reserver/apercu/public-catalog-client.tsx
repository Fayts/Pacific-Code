"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, MapPin, Phone, Waves } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import { formatMoney } from "@/lib/core/format";
import type {
  EquipmentCategory,
  EquipmentItem,
  Organization,
} from "@/lib/types/database";

export function PublicCatalogClient() {
  const { provider, loading } = useAppData();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    void (async () => {
      try {
        const [org, equipment, cats] = await Promise.all([
          provider.organization.get(),
          provider.equipment.list({ includeArchived: false }),
          provider.categories.list(),
        ]);
        if (cancelled) return;
        setOrganization(org);
        setItems(equipment.filter((e) => e.status === "available"));
        setCategories(cats);
      } catch {
        // Pas de données sur cet appareil : message ci-dessous.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, loading]);

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "Autre";

  const grouped = new Map<string, EquipmentItem[]>();
  for (const item of items) {
    const key = categoryName(item.category_id);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return (
    <div className="min-h-svh bg-pc-foam">
      {/* Bandeau aperçu */}
      <div className="flex items-center justify-center gap-2 bg-pc-night px-4 py-2 text-center text-xs text-white/80">
        <Eye className="size-3.5 shrink-0 text-pc-turquoise" aria-hidden />
        Aperçu de votre espace public — en mode démonstration, visible
        uniquement sur cet appareil.
        <Link href="/dashboard" className="font-semibold text-pc-turquoise hover:underline">
          Retour à l’application
        </Link>
      </div>

      {/* En-tête entreprise */}
      <header className="bg-gradient-to-br from-pc-night via-pc-deep to-pc-lagoon px-6 py-14 text-white">
        <div className="mx-auto max-w-4xl">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm">
            <Waves className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            {organization?.name ?? "Votre entreprise"}
          </h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/75">
            {organization?.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" aria-hidden />
                {organization.phone}
              </span>
            )}
            {organization?.address && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden />
                {organization.address}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Catalogue */}
      <main className="mx-auto max-w-4xl px-6 py-10">
        {!ready ? (
          <p className="text-center text-sm text-muted-foreground">
            Chargement du catalogue…
          </p>
        ) : grouped.size === 0 ? (
          <div className="rounded-2xl bg-card p-10 text-center shadow-sm ring-1 ring-pc-deep/[0.08]">
            <p className="font-medium text-foreground">
              Aucun catalogue sur cet appareil.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cet aperçu lit les données de démonstration du navigateur du
              loueur connecté.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {[...grouped.entries()].map(([category, categoryItems]) => (
              <section key={category}>
                <h2 className="text-lg font-semibold text-foreground">
                  {category}
                </h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-card p-5 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08] transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-medium text-foreground">
                          {item.name}
                        </h3>
                        {item.quantity_total > 1 && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            × {item.quantity_total}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-baseline justify-between">
                        <p className="text-lg font-semibold text-primary">
                          {item.daily_price > 0
                            ? `${formatMoney(item.daily_price, organization?.currency ?? "XPF")} / jour`
                            : "Prix sur demande"}
                        </p>
                        {item.deposit_amount > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Caution{" "}
                            {formatMoney(
                              item.deposit_amount,
                              organization?.currency ?? "XPF"
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="mt-12 text-center text-xs text-muted-foreground/70">
          Réservation en ligne bientôt disponible — contactez-nous par
          téléphone en attendant. Propulsé par Pacific Code 🌺
        </p>
      </main>
    </div>
  );
}
