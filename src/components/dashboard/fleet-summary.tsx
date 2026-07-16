import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type FleetCounts = {
  /** Matériels actifs (non archivés). */
  total: number;
  available: number;
  reserved: number;
  rented: number;
  maintenance: number;
  unavailable: number;
};

const SEGMENTS: {
  key: keyof Omit<FleetCounts, "total">;
  label: string;
  barClassName: string;
  dotClassName: string;
}[] = [
  {
    key: "available",
    label: "Disponibles",
    barClassName: "bg-emerald-500",
    dotClassName: "bg-emerald-500",
  },
  {
    key: "reserved",
    label: "Réservés",
    barClassName: "bg-blue-500",
    dotClassName: "bg-blue-500",
  },
  {
    key: "rented",
    label: "En location",
    barClassName: "bg-violet-500",
    dotClassName: "bg-violet-500",
  },
  {
    key: "maintenance",
    label: "En maintenance",
    barClassName: "bg-amber-500",
    dotClassName: "bg-amber-500",
  },
  {
    key: "unavailable",
    label: "Indisponibles",
    barClassName: "bg-neutral-400",
    dotClassName: "bg-neutral-400",
  },
];

export function FleetSummary({ counts }: { counts: FleetCounts }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Résumé du parc</CardTitle>
        <CardDescription>
          {counts.total === 0
            ? "Aucun matériel actif"
            : counts.total === 1
              ? "1 matériel actif"
              : `${counts.total} matériels actifs`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {counts.total === 0 ? (
          <p className="text-sm text-neutral-500">
            Ajoutez votre premier matériel pour suivre la disponibilité du
            parc.{" "}
            <Link
              href="/equipment/new"
              className="font-medium text-sky-700 hover:underline"
            >
              Ajouter un matériel
            </Link>
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
              {SEGMENTS.filter((s) => counts[s.key] > 0).map((s) => (
                <div
                  key={s.key}
                  className={s.barClassName}
                  style={{
                    width: `${(counts[s.key] / counts.total) * 100}%`,
                  }}
                  title={`${s.label} : ${counts[s.key]}`}
                />
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
              {SEGMENTS.map((s) => (
                <li
                  key={s.key}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        s.dotClassName
                      )}
                      aria-hidden
                    />
                    <span className="truncate text-neutral-600">
                      {s.label}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums text-neutral-900">
                    {counts[s.key]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
