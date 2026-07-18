import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  PlayCircle,
  Wrench,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function StatCard({
  icon: Icon,
  value,
  label,
  danger = false,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  danger?: boolean;
}) {
  return (
    <Card
      size="sm"
      className={cn(
        "transition duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-pc-deep/[0.07]",
        danger && "bg-red-50 ring-red-200"
      )}
    >
      <CardContent className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg text-white shadow-lg",
            danger
              ? "bg-gradient-to-br from-pc-coral to-red-500 shadow-red-500/25"
              : "bg-gradient-to-br from-pc-lagoon to-pc-turquoise shadow-pc-turquoise/25"
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-lg font-semibold leading-tight tabular-nums",
              danger ? "text-red-700" : "text-foreground"
            )}
            title={value}
          >
            {value}
          </p>
          <p
            className={cn(
              "truncate text-xs",
              danger ? "text-red-700/80" : "text-muted-foreground"
            )}
          >
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({
  departuresToday,
  returnsToday,
  inProgressCount,
  lateCount,
  monthRevenue,
  unavailableEquipmentCount,
}: {
  departuresToday: number;
  returnsToday: number;
  inProgressCount: number;
  lateCount: number;
  /** Montant déjà formaté (formatMoney). */
  monthRevenue: string;
  unavailableEquipmentCount: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard
        icon={ArrowUpRight}
        value={String(departuresToday)}
        label="Départs du jour"
      />
      <StatCard
        icon={ArrowDownLeft}
        value={String(returnsToday)}
        label="Retours du jour"
      />
      <StatCard
        icon={PlayCircle}
        value={String(inProgressCount)}
        label="Locations en cours"
      />
      <StatCard
        icon={AlertTriangle}
        value={String(lateCount)}
        label="En retard"
        danger={lateCount > 0}
      />
      <StatCard icon={Banknote} value={monthRevenue} label="CA estimé du mois" />
      <StatCard
        icon={Wrench}
        value={String(unavailableEquipmentCount)}
        label="Matériels indisponibles"
      />
    </div>
  );
}
