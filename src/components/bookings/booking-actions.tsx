"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Flag,
  Loader2,
  Pencil,
  Play,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  changeBookingStatus,
  duplicateBooking,
} from "@/server/actions/bookings";
import {
  BOOKING_TRANSITIONS,
  TRANSITION_LABELS,
} from "@/lib/core/booking-status";
import type { BookingStatus } from "@/lib/types/database";
import type { LucideIcon } from "lucide-react";

const TRANSITION_ICONS: Partial<Record<BookingStatus, LucideIcon>> = {
  pending: Send,
  confirmed: Check,
  in_progress: Play,
  completed: Flag,
  cancelled: X,
};

// Actions d'une réservation : transitions de statut (machine à états),
// modification et duplication.
export function BookingActions({
  bookingId,
  status,
  editable,
}: {
  bookingId: string;
  status: BookingStatus;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const transitions = BOOKING_TRANSITIONS[status] ?? [];

  const applyStatus = async (to: BookingStatus) => {
    const result = await changeBookingStatus({ bookingId, status: to });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      to === "cancelled" ? "Réservation annulée" : "Statut mis à jour"
    );
    router.refresh();
  };

  const duplicate = () => {
    startTransition(async () => {
      const result = await duplicateBooking(bookingId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Réservation dupliquée en brouillon");
      router.push(`/bookings/${result.data.bookingId}`);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {transitions
        .filter((to) => to !== "cancelled")
        .map((to) => {
          const label = TRANSITION_LABELS[to]?.label ?? to;
          const Icon = TRANSITION_ICONS[to];
          return (
            <Button
              key={to}
              type="button"
              variant={to === "pending" ? "outline" : "default"}
              disabled={pending}
              onClick={() => startTransition(() => applyStatus(to))}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                Icon && <Icon aria-hidden />
              )}
              {label}
            </Button>
          );
        })}

      {editable && (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          render={<Link href={`/bookings/${bookingId}/edit`} />}
        >
          <Pencil aria-hidden />
          Modifier
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={duplicate}
      >
        <Copy aria-hidden />
        Dupliquer
      </Button>

      {transitions.includes("cancelled") && (
        <ConfirmDialog
          trigger={
            <Button type="button" variant="destructive" disabled={pending}>
              <X aria-hidden />
              {TRANSITION_LABELS.cancelled?.label ?? "Annuler"}
            </Button>
          }
          title="Annuler la réservation"
          description={
            TRANSITION_LABELS.cancelled?.confirm ??
            "Annuler cette réservation ? Cette action est définitive."
          }
          confirmLabel="Annuler la réservation"
          destructive
          onConfirm={() => applyStatus("cancelled")}
        />
      )}
    </div>
  );
}
