import { cn } from "@/lib/utils";
import { CUSTOMER_TYPE_LABELS } from "@/lib/core/labels";
import type { CustomerType } from "@/lib/types/database";

/** Badge « Particulier » / « Professionnel » d'un client. */
export function CustomerTypeBadge({ type }: { type: CustomerType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        type === "company"
          ? "border-sky-200 bg-sky-50 text-sky-800"
          : "border-neutral-200 bg-neutral-100 text-neutral-700"
      )}
    >
      {CUSTOMER_TYPE_LABELS[type]}
    </span>
  );
}
