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
          ? "border-cyan-200 bg-cyan-50 text-cyan-800"
          : "border-border bg-muted text-muted-foreground"
      )}
    >
      {CUSTOMER_TYPE_LABELS[type]}
    </span>
  );
}
