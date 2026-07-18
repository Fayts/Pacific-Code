import type { Metadata } from "next";
import { BookingEditClient } from "@/components/bookings/booking-edit-client";

export const metadata: Metadata = {
  title: "Modifier la réservation",
};

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingEditClient id={id} />;
}
