"use client";

// Page « Nouvelle réservation » : charge clients et matériels actifs
// depuis la couche de données, calcule les défauts de période dans le
// fuseau de l'organisation, puis affiche le formulaire.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import {
  toLocalDateTimeInput,
  utcToZonedParts,
  zonedTimeToUtc,
} from "@/lib/core/dates";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingForm } from "@/components/bookings/booking-form";
import type {
  CustomerOption,
  EquipmentOption,
} from "@/components/bookings/types";

type NewData = {
  customers: CustomerOption[];
  equipment: EquipmentOption[];
};

export function BookingNewClient() {
  const { provider, organization, version } = useAppData();
  const searchParams = useSearchParams();
  const [data, setData] = useState<NewData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([provider.customers.list(), provider.equipment.list()]).then(
      ([customers, equipment]) => {
        if (!cancelled) setData({ customers, equipment });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [provider, version]);

  if (!data || !organization) {
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

  // Présélection éventuelle via ?customer= (uniquement si le client existe).
  const requestedCustomer = searchParams.get("customer");
  const initialCustomerId =
    requestedCustomer && data.customers.some((c) => c.id === requestedCustomer)
      ? requestedCustomer
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
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
        customers={data.customers}
        equipment={data.equipment}
        defaultStartAt={defaultStartAt}
        defaultEndAt={defaultEndAt}
        initialCustomerId={initialCustomerId}
      />
    </div>
  );
}
