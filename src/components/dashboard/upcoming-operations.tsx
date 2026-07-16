import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarCheck2,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookingStatusBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/core/format";
import type { DerivedBookingStatus } from "@/lib/core/labels";
import { cn } from "@/lib/utils";

export type OperationKind = "late" | "departure" | "return" | "to_confirm";

export type DashboardOperation = {
  key: string;
  kind: OperationKind;
  bookingId: string;
  bookingNumber: string;
  customerName: string;
  equipmentSummary: string;
  /** Instant de l'opération (ISO UTC) : départ, retour ou début prévu. */
  at: string;
  status: DerivedBookingStatus;
};

const KIND_CONFIG: Record<
  OperationKind,
  { icon: LucideIcon; label: string; iconClassName: string }
> = {
  late: {
    icon: AlertTriangle,
    label: "Retour en retard",
    iconClassName: "bg-red-100 text-red-700",
  },
  departure: {
    icon: ArrowUpRight,
    label: "Départ",
    iconClassName: "bg-sky-50 text-sky-700",
  },
  return: {
    icon: ArrowDownLeft,
    label: "Retour",
    iconClassName: "bg-emerald-50 text-emerald-700",
  },
  to_confirm: {
    icon: Clock,
    label: "À confirmer",
    iconClassName: "bg-amber-50 text-amber-700",
  },
};

export function UpcomingOperations({
  operations,
  timezone,
}: {
  operations: DashboardOperation[];
  timezone: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prochaines opérations</CardTitle>
        <CardDescription>
          Retards, départs et retours des 7 prochains jours
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {operations.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-emerald-50">
              <CalendarCheck2 className="size-5 text-emerald-600" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-medium text-neutral-900">
              Rien à l&apos;horizon
            </p>
            <p className="mt-1 max-w-xs text-sm text-neutral-500">
              Aucun départ, retour ni retard prévu. Profitez de cette
              accalmie&nbsp;!
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {operations.map((op) => {
              const config = KIND_CONFIG[op.kind];
              const Icon = config.icon;
              return (
                <li
                  key={op.key}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3",
                    op.kind === "late" && "bg-red-50/60"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                      config.iconClassName
                    )}
                    title={config.label}
                  >
                    <Icon className="size-4" aria-hidden />
                    <span className="sr-only">{config.label}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <Link
                        href={`/bookings/${op.bookingId}`}
                        className="text-sm font-medium text-sky-700 hover:underline"
                      >
                        {op.bookingNumber}
                      </Link>
                      <span className="truncate text-sm text-neutral-700">
                        {op.customerName}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {op.equipmentSummary || "Aucun matériel"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 sm:hidden">
                      {config.label} · {formatDateTime(op.at, timezone)}
                    </p>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                    <span
                      className={cn(
                        "text-xs",
                        op.kind === "late"
                          ? "font-medium text-red-700"
                          : "text-neutral-500"
                      )}
                    >
                      {config.label} · {formatDateTime(op.at, timezone)}
                    </span>
                    <BookingStatusBadge status={op.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
