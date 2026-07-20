"use client";

// Fiche matériel branchée sur la couche de données (mode mock).
// Statut dérivé, statistiques, prochaine réservation et historique sont
// recalculés à partir des repositories — mêmes règles que la liste et le
// tableau de bord. Pas de galerie photos ni d'historique de maintenance
// en mode démo (aucun stockage associé).

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Package, Pencil } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import type { BookingWithRelations } from "@/lib/data/repositories";
import type { EquipmentCategory, EquipmentItem } from "@/lib/types/database";
import { computeEquipmentDisplay } from "@/lib/core/equipment";
import {
  formatCustomerName,
  formatDateTime,
  formatMoney,
} from "@/lib/core/format";
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
import EquipmentDetailLoading from "@/app/(app)/equipment/[id]/loading";

const BLOCKING = ["pending", "confirmed", "in_progress"] as const;

type DetailData = {
  item: EquipmentItem | null;
  categories: EquipmentCategory[];
  bookings: BookingWithRelations[];
};

export function EquipmentDetailClient({ id }: { id: string }) {
  const { provider, organization, version } = useAppData();
  const [data, setData] = useState<DetailData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      provider.equipment.get(id),
      provider.categories.list(),
      provider.bookings.list(),
    ]).then(([item, categories, bookings]) => {
      if (!cancelled) setData({ item, categories, bookings });
    });
    return () => {
      cancelled = true;
    };
  }, [provider, version, id]);

  if (!data || !organization) {
    return <EquipmentDetailLoading />;
  }

  if (!data.item) {
    notFound();
  }

  const item = data.item;
  const now = new Date();
  const categoryName =
    (item.category_id
      ? data.categories.find((c) => c.id === item.category_id)?.name
      : null) ?? "Sans catégorie";

  // Lignes de réservation concernant ce matériel (toutes périodes).
  const rows = data.bookings.flatMap((booking) =>
    booking.items
      .filter((line) => line.equipment_id === item.id)
      .map((line) => ({ line, booking }))
  );

  // Charge actuelle : réservations bloquantes couvrant l'instant présent
  // (une location en retard compte comme sortie : le matériel n'est pas revenu).
  let rentedNow = 0;
  let reservedNow = 0;
  let minEnd: Date | null = null;
  for (const { line, booking } of rows) {
    if (!(BLOCKING as readonly string[]).includes(booking.status)) continue;
    if (new Date(booking.start_at) > now) continue;
    if (booking.status === "in_progress") {
      rentedNow += line.quantity;
    } else if (new Date(booking.end_at) > now) {
      reservedNow += line.quantity;
    } else {
      continue;
    }
    const end = new Date(booking.end_at);
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
  const history = rows
    .slice()
    .sort(
      (a, b) =>
        new Date(b.booking.start_at).getTime() -
        new Date(a.booking.start_at).getTime()
    );

  // Statistiques : CA généré et nombre de locations (en cours + terminées).
  let revenue = 0;
  const rentalIds = new Set<string>();
  for (const { line, booking } of history) {
    if (booking.status === "in_progress" || booking.status === "completed") {
      revenue += line.line_total;
      rentalIds.add(booking.id);
    }
  }

  // Prochaine réservation : pending/confirmed avec départ futur, la plus proche.
  const nextBooking =
    history
      .filter(
        ({ booking }) =>
          (booking.status === "pending" || booking.status === "confirmed") &&
          new Date(booking.start_at) > now
      )
      .sort(
        (a, b) =>
          new Date(a.booking.start_at).getTime() -
          new Date(b.booking.start_at).getTime()
      )[0] ?? null;

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
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              item.internal_ref ? `Réf. ${item.internal_ref}` : null,
              categoryName,
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
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Description et instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Description
                </h3>
                <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                  {item.description || "Aucune description."}
                </p>
              </div>
              {item.usage_instructions && (
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    Instructions d&apos;utilisation
                  </h3>
                  <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
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
                    {history.map(({ line, booking }) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <Link
                            href={`/bookings/${booking.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {booking.booking_number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {booking.customer
                            ? formatCustomerName(booking.customer)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(
                            booking.start_at,
                            organization.timezone
                          )}{" "}
                          →{" "}
                          {formatDateTime(booking.end_at, organization.timezone)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {line.quantity}
                        </TableCell>
                        <TableCell>
                          <BookingStatusBadge
                            status={derivedBookingStatus(
                              booking.status,
                              booking.end_at,
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
                  <dt className="text-muted-foreground">Prix journalier</dt>
                  <dd className="font-medium">
                    {formatMoney(item.daily_price, organization.currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Caution</dt>
                  <dd className="font-medium">
                    {formatMoney(item.deposit_amount, organization.currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Quantité totale</dt>
                  <dd className="font-medium">{item.quantity_total}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Disponible maintenant</dt>
                  <dd className="font-medium">
                    {display.availableNow} / {item.quantity_total}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Durée minimale</dt>
                  <dd className="font-medium">
                    {item.min_rental_days} jour
                    {item.min_rental_days > 1 ? "s" : ""}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Prochaine dispo</dt>
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
                  <dt className="text-muted-foreground">CA généré</dt>
                  <dd className="font-medium">
                    {formatMoney(revenue, organization.currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Nombre de locations</dt>
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
                    href={`/bookings/${nextBooking.booking.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {nextBooking.booking.booking_number}
                  </Link>
                  <p className="text-muted-foreground">
                    {nextBooking.booking.customer
                      ? formatCustomerName(nextBooking.booking.customer)
                      : "—"}
                  </p>
                  <p className="text-muted-foreground">
                    {formatDateTime(
                      nextBooking.booking.start_at,
                      organization.timezone
                    )}{" "}
                    →{" "}
                    {formatDateTime(
                      nextBooking.booking.end_at,
                      organization.timezone
                    )}
                  </p>
                  <div className="pt-1">
                    <BookingStatusBadge status={nextBooking.booking.status} />
                  </div>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="size-4" aria-hidden />
                  Aucune réservation à venir.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notes internes, carte discrète */}
          {item.internal_notes && (
            <Card className="bg-muted/50 ring-pc-deep/[0.08]">
              <CardHeader>
                <CardTitle className="text-sm text-foreground">
                  Notes internes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line text-muted-foreground">
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
