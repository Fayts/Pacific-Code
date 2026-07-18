"use client";

// Liste des clients branchée sur la couche de données (mode mock).
// Recherche, filtres et statistiques par client sont calculés côté
// client à partir des repositories — même logique que l'ancienne
// version serveur.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Plus, Users } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import type { BookingWithRelations } from "@/lib/data/repositories";
import type { Customer, CustomerType } from "@/lib/types/database";
import {
  formatCustomerName,
  formatDate,
  formatMoney,
} from "@/lib/core/format";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CustomersFilters } from "@/components/customers/customers-filters";
import { CustomerTypeBadge } from "@/components/customers/customer-type-badge";
import CustomersLoading from "@/app/(app)/customers/loading";

type CustomerStats = {
  count: number;
  lastStartAt: string | null;
  total: number;
};

/** Comparaison insensible à la casse et aux accents. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

type ListData = {
  customers: Customer[];
  bookings: BookingWithRelations[];
};

export function CustomersListClient() {
  const { provider, organization, version } = useAppData();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ListData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      provider.customers.list({ includeArchived: true }),
      provider.bookings.list(),
    ]).then(([customers, bookings]) => {
      if (!cancelled) setData({ customers, bookings });
    });
    return () => {
      cancelled = true;
    };
  }, [provider, version]);

  if (!data || !organization) {
    return <CustomersLoading />;
  }

  const { currency, timezone } = organization;

  const q = (searchParams.get("q") ?? "").trim();
  const typeParam = searchParams.get("type");
  const type: CustomerType | undefined =
    typeParam === "individual" || typeParam === "company"
      ? typeParam
      : undefined;
  const showArchived = searchParams.get("archived") === "1";
  const hasFilters = Boolean(q) || Boolean(type) || showArchived;

  const term = normalize(q);
  const customers = data.customers
    .filter((c) => (showArchived ? c.archived_at : !c.archived_at))
    .filter((c) => !type || c.type === type)
    .filter(
      (c) =>
        !term ||
        [c.first_name, c.last_name, c.company_name, c.email, c.phone]
          .filter(Boolean)
          .some((field) => normalize(String(field)).includes(term))
    )
    // Les plus récents d'abord, comme la version serveur.
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Statistiques par client, agrégées en une passe.
  const stats = new Map<string, CustomerStats>();
  for (const booking of data.bookings) {
    const entry = stats.get(booking.customer_id) ?? {
      count: 0,
      lastStartAt: null,
      total: 0,
    };
    entry.count += 1;
    if (!entry.lastStartAt || booking.start_at > entry.lastStartAt) {
      entry.lastStartAt = booking.start_at;
    }
    if (booking.status !== "cancelled" && booking.status !== "draft") {
      entry.total += booking.total_amount;
    }
    stats.set(booking.customer_id, entry);
  }

  const rows = customers.map((customer) => {
    const s = stats.get(customer.id);
    return {
      customer,
      name: formatCustomerName(customer),
      bookingCount: s?.count ?? 0,
      lastBookingAt: s?.lastStartAt ?? null,
      totalGenerated: s?.total ?? 0,
    };
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        description={
          showArchived
            ? `${customers.length} client${customers.length > 1 ? "s" : ""} archivé${customers.length > 1 ? "s" : ""}`
            : `${customers.length} client${customers.length > 1 ? "s" : ""}`
        }
        actions={
          <Button render={<Link href="/customers/new" />}>
            <Plus aria-hidden />
            Nouveau client
          </Button>
        }
      />

      <CustomersFilters q={q} type={type ?? "all"} archived={showArchived} />

      {rows.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Users}
            title="Aucun client trouvé"
            description="Aucun client ne correspond à votre recherche ou à vos filtres."
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Aucun client pour le moment"
            description="Ajoutez votre premier client pour créer vos réservations."
            action={
              <Button render={<Link href="/customers/new" />}>
                <Plus aria-hidden />
                Nouveau client
              </Button>
            }
          />
        )
      ) : (
        <>
          {/* Tableau (desktop) */}
          <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-50/60">
                  <TableHead className="pl-4">Client</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Réservations</TableHead>
                  <TableHead>Dernière réservation</TableHead>
                  <TableHead className="text-right">Total généré</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(
                  ({ customer, name, bookingCount, lastBookingAt, totalGenerated }) => (
                    <TableRow key={customer.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="font-medium text-neutral-900 hover:text-sky-700 hover:underline"
                          >
                            {name}
                          </Link>
                          {customer.type === "company" && (
                            <CustomerTypeBadge type="company" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {customer.phone || "—"}
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {customer.email || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {bookingCount}
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {lastBookingAt
                          ? formatDate(lastBookingAt, timezone)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(totalGenerated, currency)}
                      </TableCell>
                      <TableCell className="pr-3 text-right">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="text-sm font-medium text-sky-700 hover:underline"
                          aria-label={`Voir la fiche de ${name}`}
                        >
                          Voir
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </div>

          {/* Cartes empilées (mobile) */}
          <div className="space-y-3 md:hidden">
            {rows.map(
              ({ customer, name, bookingCount, lastBookingAt, totalGenerated }) => (
                <Link
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  className="block rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-neutral-900">
                          {name}
                        </p>
                        {customer.type === "company" && (
                          <CustomerTypeBadge type="company" />
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-neutral-500">
                        {[customer.phone, customer.email]
                          .filter(Boolean)
                          .join(" · ") || "Aucune coordonnée"}
                      </p>
                    </div>
                    <ChevronRight
                      className="mt-0.5 size-4 shrink-0 text-neutral-400"
                      aria-hidden
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-sm">
                    <span className="text-neutral-500">
                      {bookingCount} réservation{bookingCount > 1 ? "s" : ""}
                      {lastBookingAt
                        ? ` · dernière le ${formatDate(lastBookingAt, timezone)}`
                        : ""}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(totalGenerated, currency)}
                    </span>
                  </div>
                </Link>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
