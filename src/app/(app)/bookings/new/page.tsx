import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireOrgContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import {
  toLocalDateTimeInput,
  utcToZonedParts,
  zonedTimeToUtc,
} from "@/lib/core/dates";
import { PageHeader } from "@/components/shared/page-header";
import { BookingForm } from "@/components/bookings/booking-form";
import type {
  CustomerOption,
  EquipmentOption,
} from "@/components/bookings/types";

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const sp = await searchParams;
  const context = await requireOrgContext();
  const { organization } = context;
  const supabase = await createClient();

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

  const customerOptions = (customers ?? []) as CustomerOption[];
  const equipmentOptions = (equipment ?? []) as EquipmentOption[];

  // Présélection éventuelle via ?customer= (uniquement si le client existe).
  const initialCustomerId =
    sp.customer && customerOptions.some((c) => c.id === sp.customer)
      ? sp.customer
      : null;

  // Défauts : demain 08:00 → demain 17:00 dans le fuseau de l'organisation.
  const tz = organization.timezone;
  const nowParts = utcToZonedParts(new Date(), tz);
  const defaultStartAt = toLocalDateTimeInput(
    zonedTimeToUtc(
      {
        year: nowParts.year,
        month: nowParts.month,
        day: nowParts.day + 1,
        hour: 8,
        minute: 0,
      },
      tz
    ),
    tz
  );
  const defaultEndAt = toLocalDateTimeInput(
    zonedTimeToUtc(
      {
        year: nowParts.year,
        month: nowParts.month,
        day: nowParts.day + 1,
        hour: 17,
        minute: 0,
      },
      tz
    ),
    tz
  );

  return (
    <div>
      <Link
        href="/bookings"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Réservations
      </Link>
      <PageHeader
        title="Nouvelle réservation"
        description="Choisissez le client, le matériel et la période — la disponibilité est vérifiée automatiquement."
      />
      <BookingForm
        mode="create"
        organization={{
          currency: organization.currency,
          timezone: organization.timezone,
        }}
        customers={customerOptions}
        equipment={equipmentOptions}
        defaultStartAt={defaultStartAt}
        defaultEndAt={defaultEndAt}
        initialCustomerId={initialCustomerId}
      />
    </div>
  );
}
