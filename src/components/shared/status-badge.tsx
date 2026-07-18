import { cn } from "@/lib/utils";
import {
  BOOKING_STATUS,
  DEPOSIT_STATUS,
  EQUIPMENT_STATUS,
  PAYMENT_STATUS,
  type DerivedBookingStatus,
  type EquipmentDisplayStatus,
} from "@/lib/core/labels";
import type { DepositStatus, PaymentStatus } from "@/lib/types/database";

function BaseBadge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        className
      )}
    >
      {label}
    </span>
  );
}

export function BookingStatusBadge({
  status,
}: {
  status: DerivedBookingStatus;
}) {
  const style = BOOKING_STATUS[status];
  return <BaseBadge label={style.label} className={style.className} />;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const style = PAYMENT_STATUS[status];
  return <BaseBadge label={style.label} className={style.className} />;
}

export function DepositStatusBadge({ status }: { status: DepositStatus }) {
  const style = DEPOSIT_STATUS[status];
  return <BaseBadge label={style.label} className={style.className} />;
}

export function EquipmentStatusBadge({
  status,
}: {
  status: EquipmentDisplayStatus;
}) {
  const style = EQUIPMENT_STATUS[status];
  return <BaseBadge label={style.label} className={style.className} />;
}
