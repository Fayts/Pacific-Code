import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Package, Pencil, Wrench } from "lucide-react";
import { requireOrgContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { computeEquipmentDisplay } from "@/lib/core/equipment";
import {
  formatCustomerName,
  formatDateTime,
  formatMoney,
} from "@/lib/core/format";
import { equipmentImageUrl } from "@/lib/core/storage";
import { derivedBookingStatus } from "@/lib/core/labels";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BookingStatusBadge,
  EquipmentStatusBadge,
} from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { EquipmentActions } from "@/components/equipment/equipment-actions";
import type { BookingStatus } from "@/lib/types/database";

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
];

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireOrgContext();
  const { organization } = context;
  const supabase = await createClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: item } = await supabase
    .from("equipment_items")
    .select("*, category:equipment_categories(id, name)")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (!item) notFound();

  const [
    { data: images },
    { data: loadRows },
    { data: bookingRows },
    { data: maintenanceRecords },
  ] = await Promise.all([
    supabase
      .from("equipment_images")
      .select("*")
      .eq("equipment_id", id)
      .eq("organization_id", organization.id)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    // Charge actuelle : réservations actives couvrant l'instant présent.
    supabase
      .from("booking_items")
      .select("quantity, bookings!inner(status, end_at)")
      .eq("organization_id", organization.id)
      .eq("equipment_id", id)
      .in("bookings.status", ACTIVE_BOOKING_STATUSES)
      .lt("bookings.start_at", nowIso)
      .gt("bookings.end_at", nowIso),
    // Toutes les réservations liées à ce matériel (historique + stats).
    supabase
      .from("booking_items")
      .select(
        "id, quantity, line_total, bookings!inner(id, booking_number, status, start_at, end_at, customer:customers(type, first_name, last_name, company_name))"
      )
      .eq("organization_id", organization.id)
      .eq("equipment_id", id),
    supabase
      .from("maintenance_records")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("equipment_id", id)
      .order("started_at", { ascending: false }),
  ]);

  // Statut d'affichage dérivé de la charge actuelle.
  let rentedNow = 0;
  let reservedNow = 0;
  let minEnd: Date | null = null;
  for (const row of loadRows ?? []) {
    if (row.bookings.status === "in_progress") {
      rentedNow += row.quantity;
    } else {
      reservedNow += row.quantity;
    }
    const end = new Date(row.bookings.end_at);
    if (!minEnd || end < minEnd) minEnd = end;
  }
  const display = computeEquipmentDisplay(item, { rentedNow, reservedNow });

  const nextAvailability =
    display.status === "available"
      ? "Maintenant"
      : (display.status === "rented" || display.status === "reserved") && minEnd
        ? formatDateTime(minEnd, organization.timezone)
        : "—";

  // Historique trié du plus récent au plus ancien.
  const history = (bookingRows ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.bookings.start_at).getTime() -
        new Date(a.bookings.start_at).getTime()
    );

  // Statistiques : CA généré et nombre de locations (en cours + terminées).
  let revenue = 0;
  const rentalIds = new Set<string>();
  for (const row of history) {
    if (
      row.bookings.status === "in_progress" ||
      row.bookings.status === "completed"
    ) {
      revenue += row.line_total;
      rentalIds.add(row.bookings.id);
    }
  }

  // Prochaine réservation : pending/confirmed avec départ futur, la plus proche.
  const nextBooking =
    history
      .filter(
        (row) =>
          (row.bookings.status === "pending" ||
            row.bookings.status === "confirmed") &&
          new Date(row.bookings.start_at) > now
      )
      .sort(
        (a, b) =>
          new Date(a.bookings.start_at).getTime() -
          new Date(b.bookings.start_at).getTime()
      )[0] ?? null;

  const sortedImages = images ?? [];
  const isArchived = Boolean(item.archived_at);

  return (
    <>
      {/* En-tête */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              {item.name}
            </h1>
            <EquipmentStatusBadge status={display.status} />
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {[
              item.internal_ref ? `Réf. ${item.internal_ref}` : null,
              item.category?.name ?? "Sans catégorie",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isArchived && (
            <Button
              variant="outline"
              render={<Link href={`/equipment/${item.id}/edit`} />}
            >
              <Pencil aria-hidden />
              Modifier
            </Button>
          )}
          <EquipmentActions
            equipmentId={item.id}
            name={item.name}
            status={item.status}
            archived={isArchived}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Galerie photos */}
          {sortedImages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {sortedImages.map((image) => (
                    <div
                      key={image.id}
                      className="relative overflow-hidden rounded-md border border-neutral-200"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={equipmentImageUrl(image.storage_path)}
                        alt={`Photo de ${item.name}`}
                        className="aspect-square w-full object-cover"
                      />
                      {image.is_primary && (
                        <span className="absolute top-1.5 left-1.5 rounded bg-sky-700 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          Principale
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Description et instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-neutral-900">
                  Description
                </h3>
                <p className="mt-1 text-sm whitespace-pre-line text-neutral-600">
                  {item.description || "Aucune description."}
                </p>
              </div>
              {item.usage_instructions && (
                <div>
                  <h3 className="text-sm font-medium text-neutral-900">
                    Instructions d&apos;utilisation
                  </h3>
                  <p className="mt-1 text-sm whitespace-pre-line text-neutral-600">
                    {item.usage_instructions}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historique des réservations */}
          <Card>
            <CardHeader>
              <CardTitle>Historique des réservations</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="Aucune réservation"
                  description="Ce matériel n'a pas encore été réservé."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numéro</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead className="text-right">Qté</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Link
                            href={`/bookings/${row.bookings.id}`}
                            className="font-medium text-sky-700 hover:underline"
                          >
                            {row.bookings.booking_number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-neutral-600">
                          {row.bookings.customer
                            ? formatCustomerName(row.bookings.customer)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-neutral-600">
                          {formatDateTime(
                            row.bookings.start_at,
                            organization.timezone
                          )}{" "}
                          →{" "}
                          {formatDateTime(
                            row.bookings.end_at,
                            organization.timezone
                          )}
                        </TableCell>
                        <TableCell className="text-right text-neutral-600">
                          {row.quantity}
                        </TableCell>
                        <TableCell>
                          <BookingStatusBadge
                            status={derivedBookingStatus(
                              row.bookings.status,
                              row.bookings.end_at,
                              now
                            )}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Historique de maintenance */}
          <Card>
            <CardHeader>
              <CardTitle>Historique de maintenance</CardTitle>
            </CardHeader>
            <CardContent>
              {(maintenanceRecords ?? []).length === 0 ? (
                <EmptyState
                  icon={Wrench}
                  title="Aucune intervention"
                  description="Ce matériel n'a jamais été mis en maintenance."
                />
              ) : (
                <div className="space-y-3">
                  {(maintenanceRecords ?? []).map((record) => (
                    <div
                      key={record.id}
                      className="rounded-md border border-neutral-200 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-medium text-neutral-900">
                          {record.description}
                        </p>
                        {record.cost !== null && (
                          <span className="text-sm text-neutral-600">
                            {formatMoney(record.cost, organization.currency)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        Du{" "}
                        {formatDateTime(
                          record.started_at,
                          organization.timezone
                        )}
                        {record.ended_at
                          ? ` au ${formatDateTime(record.ended_at, organization.timezone)}`
                          : " — en cours"}
                      </p>
                      {record.notes && (
                        <p className="mt-1 text-sm text-neutral-600">
                          {record.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Tarifs et stock */}
          <Card>
            <CardHeader>
              <CardTitle>Tarifs et stock</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-500">Prix journalier</dt>
                  <dd className="font-medium">
                    {formatMoney(item.daily_price, organization.currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-500">Caution</dt>
                  <dd className="font-medium">
                    {formatMoney(item.deposit_amount, organization.currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-500">Quantité totale</dt>
                  <dd className="font-medium">{item.quantity_total}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-500">Disponible maintenant</dt>
                  <dd className="font-medium">
                    {display.availableNow} / {item.quantity_total}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-500">Durée minimale</dt>
                  <dd className="font-medium">
                    {item.min_rental_days} jour
                    {item.min_rental_days > 1 ? "s" : ""}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-500">Prochaine dispo</dt>
                  <dd className="font-medium">{nextAvailability}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Statistiques */}
          <Card>
            <CardHeader>
              <CardTitle>Statistiques</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-500">CA généré</dt>
                  <dd className="font-medium">
                    {formatMoney(revenue, organization.currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-500">Nombre de locations</dt>
                  <dd className="font-medium">{rentalIds.size}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Prochaine réservation */}
          <Card>
            <CardHeader>
              <CardTitle>Prochaine réservation</CardTitle>
            </CardHeader>
            <CardContent>
              {nextBooking ? (
                <div className="space-y-1 text-sm">
                  <Link
                    href={`/bookings/${nextBooking.bookings.id}`}
                    className="font-medium text-sky-700 hover:underline"
                  >
                    {nextBooking.bookings.booking_number}
                  </Link>
                  <p className="text-neutral-600">
                    {nextBooking.bookings.customer
                      ? formatCustomerName(nextBooking.bookings.customer)
                      : "—"}
                  </p>
                  <p className="text-neutral-500">
                    {formatDateTime(
                      nextBooking.bookings.start_at,
                      organization.timezone
                    )}{" "}
                    →{" "}
                    {formatDateTime(
                      nextBooking.bookings.end_at,
                      organization.timezone
                    )}
                  </p>
                  <div className="pt-1">
                    <BookingStatusBadge status={nextBooking.bookings.status} />
                  </div>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-neutral-500">
                  <Package className="size-4" aria-hidden />
                  Aucune réservation à venir.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notes internes, carte discrète */}
          {item.internal_notes && (
            <Card className="bg-neutral-50 ring-neutral-200">
              <CardHeader>
                <CardTitle className="text-sm text-neutral-700">
                  Notes internes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line text-neutral-600">
                  {item.internal_notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
