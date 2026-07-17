"use client";

// Liste du matériel branchée sur la couche de données (mode mock).
// Recherche, filtres et statuts dérivés sont calculés côté client à
// partir des repositories — même logique que l'ancienne version serveur.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Package, Plus, SearchX } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import type { BookingWithRelations } from "@/lib/data/repositories";
import type { EquipmentCategory, EquipmentItem } from "@/lib/types/database";
import { computeEquipmentDisplay } from "@/lib/core/equipment";
import { formatDateTime, formatMoney } from "@/lib/core/format";
import type { EquipmentDisplayStatus } from "@/lib/core/labels";
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
import { EquipmentStatusBadge } from "@/components/shared/status-badge";
import { EquipmentToolbar } from "@/components/equipment/equipment-toolbar";
import EquipmentLoading from "@/app/(app)/equipment/loading";

const BLOCKING = ["pending", "confirmed", "in_progress"] as const;

const DISPLAY_STATUS_FILTERS: EquipmentDisplayStatus[] = [
  "available",
  "reserved",
  "rented",
  "maintenance",
  "unavailable",
];

/** Comparaison insensible à la casse et aux accents. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function Thumbnail() {
  // Pas de stockage de photos en mode démo : visuel de substitution.
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-neutral-100">
      <Package className="size-5 text-neutral-400" aria-hidden />
    </span>
  );
}

type ListData = {
  equipment: EquipmentItem[];
  categories: EquipmentCategory[];
  bookings: BookingWithRelations[];
};

export function EquipmentListClient() {
  const { provider, organization, version } = useAppData();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ListData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      provider.equipment.list({ includeArchived: true }),
      provider.categories.list(),
      provider.bookings.list(),
    ]).then(([equipment, categories, bookings]) => {
      if (!cancelled) setData({ equipment, categories, bookings });
    });
    return () => {
      cancelled = true;
    };
  }, [provider, version]);

  if (!data || !organization) {
    return <EquipmentLoading />;
  }

  const q = (searchParams.get("q") ?? "").trim();
  const categoryFilter = searchParams.get("category") ?? "";
  const statusParam = searchParams.get("status") ?? "";
  const showArchived = searchParams.get("archived") === "1";
  const statusFilter = DISPLAY_STATUS_FILTERS.includes(
    statusParam as EquipmentDisplayStatus
  )
    ? (statusParam as EquipmentDisplayStatus)
    : null;

  const now = new Date();
  const categoryNames = new Map(data.categories.map((c) => [c.id, c.name]));

  // Charges actuelles : réservations actives couvrant l'instant présent.
  const loads = new Map<
    string,
    { rentedNow: number; reservedNow: number; minEnd: Date | null }
  >();
  for (const booking of data.bookings) {
    if (!(BLOCKING as readonly string[]).includes(booking.status)) continue;
    if (new Date(booking.start_at) > now) continue;
    if (booking.status !== "in_progress" && new Date(booking.end_at) <= now) {
      continue;
    }
    for (const item of booking.items) {
      const entry = loads.get(item.equipment_id) ?? {
        rentedNow: 0,
        reservedNow: 0,
        minEnd: null as Date | null,
      };
      if (booking.status === "in_progress") {
        entry.rentedNow += item.quantity;
      } else {
        entry.reservedNow += item.quantity;
      }
      const end = new Date(booking.end_at);
      if (!entry.minEnd || end < entry.minEnd) entry.minEnd = end;
      loads.set(item.equipment_id, entry);
    }
  }

  const term = normalize(q);
  const items = data.equipment
    .filter((item) => (showArchived ? item.archived_at : !item.archived_at))
    .filter((item) => !categoryFilter || item.category_id === categoryFilter)
    .filter(
      (item) =>
        !term ||
        normalize(item.name).includes(term) ||
        normalize(item.internal_ref ?? "").includes(term)
    );

  const rows = items.map((item) => {
    const load = loads.get(item.id) ?? {
      rentedNow: 0,
      reservedNow: 0,
      minEnd: null,
    };
    const display = computeEquipmentDisplay(item, {
      rentedNow: load.rentedNow,
      reservedNow: load.reservedNow,
    });

    let nextAvailability = "—";
    if (display.status === "available") {
      nextAvailability = "Maintenant";
    } else if (
      (display.status === "rented" || display.status === "reserved") &&
      load.minEnd
    ) {
      nextAvailability = formatDateTime(load.minEnd, organization.timezone);
    }

    return { item, display, nextAvailability };
  });

  const filteredRows = statusFilter
    ? rows.filter((row) => row.display.status === statusFilter)
    : rows;

  const hasFilters = Boolean(q || categoryFilter || statusFilter);
  const parkIsEmpty = rows.length === 0 && !hasFilters && !showArchived;

  return (
    <>
      <PageHeader
        title="Matériel"
        description={
          showArchived
            ? "Matériels archivés — ils n'apparaissent plus dans le parc actif."
            : "Votre parc de matériel de location."
        }
        actions={
          <Button render={<Link href="/equipment/new" />}>
            <Plus aria-hidden />
            Ajouter un matériel
          </Button>
        }
      />

      <EquipmentToolbar
        categories={data.categories}
        q={q}
        category={categoryFilter}
        status={statusFilter ?? ""}
        archived={showArchived}
      />

      {parkIsEmpty ? (
        <EmptyState
          icon={Package}
          title="Aucun matériel dans votre parc"
          description="Ajoutez votre premier matériel pour commencer à créer des réservations."
          action={
            <Button render={<Link href="/equipment/new" />}>
              <Plus aria-hidden />
              Ajouter un matériel
            </Button>
          }
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={
            showArchived && !hasFilters
              ? "Aucun matériel archivé"
              : "Aucun matériel ne correspond à ces critères"
          }
          description="Essayez de modifier la recherche ou les filtres."
          action={
            <Button variant="outline" render={<Link href="/equipment" />}>
              Réinitialiser les filtres
            </Button>
          }
        />
      ) : (
        <>
          {/* Tableau desktop */}
          <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 pl-3">Photo</TableHead>
                  <TableHead>Matériel</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Prix / jour</TableHead>
                  <TableHead className="text-right">Caution</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Prochaine dispo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map(({ item, display, nextAvailability }) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-3">
                      <Thumbnail />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/equipment/${item.id}`}
                        className="font-medium text-neutral-900 hover:underline"
                      >
                        {item.name}
                      </Link>
                      {item.internal_ref && (
                        <p className="text-xs text-neutral-500">
                          Réf. {item.internal_ref}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-neutral-600">
                      {item.category_id
                        ? (categoryNames.get(item.category_id) ?? "—")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(item.daily_price, organization.currency)}
                    </TableCell>
                    <TableCell className="text-right text-neutral-600">
                      {formatMoney(item.deposit_amount, organization.currency)}
                    </TableCell>
                    <TableCell>
                      <EquipmentStatusBadge status={display.status} />
                    </TableCell>
                    <TableCell className="text-neutral-600">
                      {nextAvailability}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Cartes mobile */}
          <div className="space-y-3 md:hidden">
            {filteredRows.map(({ item, display, nextAvailability }) => (
              <Link
                key={item.id}
                href={`/equipment/${item.id}`}
                className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-3"
              >
                <Thumbnail />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900">
                        {item.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {[
                          item.internal_ref ? `Réf. ${item.internal_ref}` : null,
                          item.category_id
                            ? (categoryNames.get(item.category_id) ?? null)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    <EquipmentStatusBadge status={display.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-medium">
                      {formatMoney(item.daily_price, organization.currency)}
                      <span className="font-normal text-neutral-500"> / jour</span>
                    </span>
                    <span className="text-neutral-500">
                      Caution{" "}
                      {formatMoney(item.deposit_amount, organization.currency)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Prochaine dispo : {nextAvailability}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
