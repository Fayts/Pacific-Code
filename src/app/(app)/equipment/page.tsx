import Link from "next/link";
import { Package, Plus, SearchX } from "lucide-react";
import { requireOrgContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { computeEquipmentDisplay } from "@/lib/core/equipment";
import { formatDateTime, formatMoney } from "@/lib/core/format";
import { equipmentImageUrl } from "@/lib/core/storage";
import type { EquipmentDisplayStatus } from "@/lib/core/labels";
import type { BookingStatus } from "@/lib/types/database";
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

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
];

const DISPLAY_STATUS_FILTERS: EquipmentDisplayStatus[] = [
  "available",
  "reserved",
  "rented",
  "maintenance",
  "unavailable",
];

function Thumbnail({ storagePath }: { storagePath: string | null }) {
  if (storagePath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={equipmentImageUrl(storagePath)}
        alt=""
        className="size-11 shrink-0 rounded-md border border-neutral-200 object-cover"
      />
    );
  }
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-neutral-100">
      <Package className="size-5 text-neutral-400" aria-hidden />
    </span>
  );
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? "";

  const q = first(sp.q).trim();
  const categoryFilter = first(sp.category);
  const statusParam = first(sp.status);
  const showArchived = first(sp.archived) === "1";
  const statusFilter = DISPLAY_STATUS_FILTERS.includes(
    statusParam as EquipmentDisplayStatus
  )
    ? (statusParam as EquipmentDisplayStatus)
    : null;

  const context = await requireOrgContext();
  const { organization } = context;
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  let equipmentQuery = supabase
    .from("equipment_items")
    .select(
      "*, category:equipment_categories(id, name), equipment_images(id, storage_path, is_primary, sort_order)"
    )
    .eq("organization_id", organization.id)
    .order("name", { ascending: true });

  equipmentQuery = showArchived
    ? equipmentQuery.not("archived_at", "is", null)
    : equipmentQuery.is("archived_at", null);

  if (categoryFilter) {
    equipmentQuery = equipmentQuery.eq("category_id", categoryFilter);
  }

  // Nettoyage des caractères réservés de la syntaxe .or() de PostgREST.
  const term = q.replace(/[,()"'\\]/g, " ").trim();
  if (term) {
    equipmentQuery = equipmentQuery.or(
      `name.ilike.%${term}%,internal_ref.ilike.%${term}%`
    );
  }

  const [{ data: items }, { data: categories }, { data: loadRows }] =
    await Promise.all([
      equipmentQuery,
      supabase
        .from("equipment_categories")
        .select("id, name")
        .eq("organization_id", organization.id)
        .order("name", { ascending: true }),
      // Charges actuelles : réservations actives couvrant l'instant présent.
      supabase
        .from("booking_items")
        .select("equipment_id, quantity, bookings!inner(status, start_at, end_at)")
        .eq("organization_id", organization.id)
        .in("bookings.status", ACTIVE_BOOKING_STATUSES)
        .lt("bookings.start_at", nowIso)
        .gt("bookings.end_at", nowIso),
    ]);

  // Agrégation par matériel : quantités sorties / réservées + prochain retour.
  const loads = new Map<
    string,
    { rentedNow: number; reservedNow: number; minEnd: Date | null }
  >();
  for (const row of loadRows ?? []) {
    const entry =
      loads.get(row.equipment_id) ??
      ({ rentedNow: 0, reservedNow: 0, minEnd: null } as {
        rentedNow: number;
        reservedNow: number;
        minEnd: Date | null;
      });
    if (row.bookings.status === "in_progress") {
      entry.rentedNow += row.quantity;
    } else {
      entry.reservedNow += row.quantity;
    }
    const end = new Date(row.bookings.end_at);
    if (!entry.minEnd || end < entry.minEnd) entry.minEnd = end;
    loads.set(row.equipment_id, entry);
  }

  const rows = (items ?? []).map((item) => {
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

    const primaryImage =
      item.equipment_images
        .slice()
        .sort(
          (a, b) =>
            Number(b.is_primary) - Number(a.is_primary) ||
            a.sort_order - b.sort_order
        )[0] ?? null;

    return { item, display, nextAvailability, primaryImage };
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
        categories={categories ?? []}
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
                {filteredRows.map(({ item, display, nextAvailability, primaryImage }) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-3">
                      <Thumbnail
                        storagePath={primaryImage?.storage_path ?? null}
                      />
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
                      {item.category?.name ?? "—"}
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
            {filteredRows.map(({ item, display, nextAvailability, primaryImage }) => (
              <Link
                key={item.id}
                href={`/equipment/${item.id}`}
                className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-3"
              >
                <Thumbnail storagePath={primaryImage?.storage_path ?? null} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900">
                        {item.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {[
                          item.internal_ref ? `Réf. ${item.internal_ref}` : null,
                          item.category?.name ?? null,
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
