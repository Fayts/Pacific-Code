import type { Booking } from "@/lib/types";
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/data";
import { Badge } from "@/components/ui";

const STATUS_TONES: Record<Booking["status"], "amber" | "lagoon" | "navy" | "green" | "red"> = {
  en_attente: "amber",
  confirmee: "lagoon",
  en_cours: "navy",
  terminee: "green",
  annulee: "red",
};

const PAYMENT_TONES: Record<Booking["paymentStatus"], "amber" | "green" | "gray"> = {
  en_attente: "amber",
  paye: "green",
  rembourse: "gray",
};

export function StatusBadge({ status }: { status: Booking["status"] }) {
  return <Badge tone={STATUS_TONES[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>;
}

export function PaymentBadge({ status }: { status: Booking["paymentStatus"] }) {
  return <Badge tone={PAYMENT_TONES[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

/** Table admin : scroll horizontal sur mobile, lignes cliquables si href */
export function AdminTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-mist-200 bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-mist-200 bg-mist-50 text-left">
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-navy-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-mist-100">{children}</tbody>
      </table>
    </div>
  );
}
