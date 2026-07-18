"use client";

// Page « Modifier une réservation » : charge la réservation, les clients
// et matériels (y compris archivés s'ils sont encore référencés) depuis
// la couche de données, puis affiche le formulaire pré-rempli.
// Une réservation démarrée, terminée ou annulée n'est plus modifiable :
// retour à la fiche.

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import type { BookingWithRelations } from "@/lib/data/repositories";
import type { Customer, EquipmentItem } from "@/lib/types/database";
import { isEditableStatus } from "@/lib/core/booking-status";
import { toLocalDateTimeInput } from "@/lib/core/dates";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingForm } from "@/components/bookings/booking-form";
import type {
  CustomerOption,
  EquipmentOption,
} from "@/components/bookings/types";

type EditData = {
  booking: BookingWithRelations | null;
  customers: Customer[];
  equipment: EquipmentItem[];
};

export function BookingEditClient({ id }: { id: string }) {
  const { provider, organization } = useAppData();
  const router = useRouter();
  const [data, setData] = useState<EditData | null>(null);

  // Chargé une seule fois (pas de dépendance à version) : le formulaire
  // garde son état local pendant que l'utilisateur le remplit.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      provider.bookings.get(id),
      provider.customers.list({ includeArchived: true }),
      provider.equipment.list({ includeArchived: true }),
    ]).then(([booking, customers, equipment]) => {
      if (!cancelled) setData({ booking, customers, equipment });
    });
    return () => {
      cancelled = true;
    };
  }, [provider, id]);

  const booking = data?.booking ?? null;
  const editable = booking ? isEditableStatus(booking.status) : true;

  useEffect(() => {
    if (booking && !editable) {
      router.replace(`/bookings/${booking.id}`);
    }
  }, [booking, editable, router]);

  if (!data || !organization || (booking && !editable)) {
    return (
      <div>
        <Skeleton className="mb-3 h-4 w-28" />
        <Skeleton className="mb-6 h-7 w-64" />
        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!booking) {
    notFound();
  }

  // Clients actifs + le client de la réservation même s'il a été archivé.
  const customerOptions: CustomerOption[] = data.customers.filter(
    (c) => !c.archived_at || c.id === booking.customer_id
  );

  // Matériels actifs + ceux encore référencés par la réservation.
  const referencedIds = new Set(booking.items.map((item) => item.equipment_id));
  const equipmentOptions: EquipmentOption[] = data.equipment.filter(
    (e) => !e.archived_at || referencedIds.has(e.id)
  );

  const tz = organization.timezone;
  const startAt = toLocalDateTimeInput(new Date(booking.start_at), tz);
  const endAt = toLocalDateTimeInput(new Date(booking.end_at), tz);

  return (
    <div>
      <Link
        href={`/bookings/${booking.id}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {booking.booking_number}
      </Link>
      <PageHeader
        title={`Modifier ${booking.booking_number}`}
        description="La disponibilité est revérifiée en excluant cette réservation."
      />
      <BookingForm
        mode="edit"
        bookingId={booking.id}
        organization={{
          currency: organization.currency,
          timezone: organization.timezone,
        }}
        customers={customerOptions}
        equipment={equipmentOptions}
        defaultStartAt={startAt}
        defaultEndAt={endAt}
        initialValues={{
          customerId: booking.customer_id,
          items: booking.items.map((item) => ({
            equipmentId: item.equipment_id,
            quantity: item.quantity,
          })),
          startAt,
          endAt,
          discountAmount: booking.discount_amount,
          extraFeesAmount: booking.extra_fees_amount,
          depositAmount: booking.deposit_amount,
          notes: booking.notes ?? "",
          status: booking.status,
        }}
      />
    </div>
  );
}
