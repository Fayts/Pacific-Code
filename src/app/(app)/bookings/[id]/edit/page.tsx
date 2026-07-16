import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireOrgContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { isEditableStatus } from "@/lib/core/booking-status";
import { toLocalDateTimeInput } from "@/lib/core/dates";
import { PageHeader } from "@/components/shared/page-header";
import { BookingForm } from "@/components/bookings/booking-form";
import type {
  CustomerOption,
  EquipmentOption,
} from "@/components/bookings/types";
import type { Booking, BookingItem } from "@/lib/types/database";

type BookingWithItems = Booking & { booking_items: BookingItem[] };

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireOrgContext();
  const { organization } = context;
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select("*, booking_items(*)")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (!data) notFound();
  const booking = data as unknown as BookingWithItems;

  // Une réservation démarrée, terminée ou annulée n'est plus modifiable.
  if (!isEditableStatus(booking.status)) {
    redirect(`/bookings/${booking.id}`);
  }

  const [{ data: customers }, { data: equipment }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, type, first_name, last_name, company_name, email, phone")
      .eq("organization_id", organization.id)
      .is("archived_at", null)
      .order("last_name", { ascending: true })
      .order("company_name", { ascending: true }),
    supabase
      .from("equipment_items")
      .select(
        "id, name, daily_price, deposit_amount, quantity_total, min_rental_days, status"
      )
      .eq("organization_id", organization.id)
      .is("archived_at", null)
      .order("name", { ascending: true }),
  ]);

  let customerOptions = (customers ?? []) as CustomerOption[];
  let equipmentOptions = (equipment ?? []) as EquipmentOption[];

  // Le client de la réservation peut avoir été archivé entre-temps :
  // on l'ajoute pour que la sélection reste visible.
  if (!customerOptions.some((c) => c.id === booking.customer_id)) {
    const { data: archivedCustomer } = await supabase
      .from("customers")
      .select("id, type, first_name, last_name, company_name, email, phone")
      .eq("organization_id", organization.id)
      .eq("id", booking.customer_id)
      .maybeSingle();
    if (archivedCustomer) {
      customerOptions = [archivedCustomer as CustomerOption, ...customerOptions];
    }
  }

  // Idem pour du matériel archivé encore présent sur la réservation.
  const missingEquipmentIds = booking.booking_items
    .map((item) => item.equipment_id)
    .filter((eqId) => !equipmentOptions.some((e) => e.id === eqId));
  if (missingEquipmentIds.length > 0) {
    const { data: missingEquipment } = await supabase
      .from("equipment_items")
      .select(
        "id, name, daily_price, deposit_amount, quantity_total, min_rental_days, status"
      )
      .eq("organization_id", organization.id)
      .in("id", missingEquipmentIds);
    equipmentOptions = [
      ...((missingEquipment ?? []) as EquipmentOption[]),
      ...equipmentOptions,
    ];
  }

  const tz = organization.timezone;
  const startAt = toLocalDateTimeInput(new Date(booking.start_at), tz);
  const endAt = toLocalDateTimeInput(new Date(booking.end_at), tz);

  return (
    <div>
      <Link
        href={`/bookings/${booking.id}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
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
          items: booking.booking_items.map((item) => ({
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
