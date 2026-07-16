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
      className={cn(danger && "bg-red-50 ring-red-200")}
    >
      <CardContent className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            danger ? "bg-red-100 text-red-700" : "bg-sky-50 text-sky-700"
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-lg font-semibold leading-tight",
              danger ? "text-red-800" : "text-neutral-900"
            )}
            title={value}
          >
            {value}
          </p>
          <p
            className={cn(
              "truncate text-xs",
              danger ? "text-red-700" : "text-neutral-500"
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
