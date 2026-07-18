import { Waves } from "lucide-react";
import { cn } from "@/lib/utils";

// Maquette illustrative du produit — données fictives locales, aucune logique.

const STATS = [
  { label: "Locations en cours", value: "4" },
  { label: "Retours aujourd'hui", value: "2" },
  { label: "CA du mois", value: "412 500 XPF" },
];

const WEEK = [
  { day: "L", bars: ["lagoon"] },
  { day: "M", bars: ["lagoon", "coral"] },
  { day: "M", bars: ["lagoon"] },
  { day: "J", bars: ["lagoon", "lagoon"] },
  { day: "V", bars: ["coral"] },
  { day: "S", bars: ["lagoon"] },
  { day: "D", bars: [] },
] as const;

const ROWS = [
  {
    item: "Scooter 125 cc",
    detail: "Moana T. · 3 jours",
    status: "Confirmée",
    tone: "bg-pc-turquoise/15 text-pc-mist",
  },
  {
    item: "Voiture citadine",
    detail: "Retour aujourd'hui · 17 h",
    status: "En location",
    tone: "bg-pc-gold/15 text-pc-gold",
  },
  {
    item: "Injecteur-extracteur",
    detail: "Zone Papeete",
    status: "Disponible",
    tone: "bg-emerald-400/15 text-emerald-300",
  },
];

export function DashboardPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className
      )}
    >
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white">
            <Waves className="size-3.5" aria-hidden />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-white">
              Tableau de bord
            </p>
            <p className="text-[9px] text-white/50">
              Jeudi 17 juillet · Papeete
            </p>
          </div>
        </div>
        <span className="size-6 rounded-full bg-gradient-to-br from-pc-coral/80 to-pc-gold/80" />
      </div>

      {/* Indicateurs */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-white/8 bg-white/[0.05] px-2.5 py-2"
          >
            <p className="truncate text-[9px] text-white/50">{stat.label}</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-white">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Semaine */}
      <div className="mt-3 rounded-lg border border-white/8 bg-white/[0.05] p-2.5">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEK.map((cell, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[8px] text-white/40">{cell.day}</span>
              <div className="flex h-9 w-full flex-col justify-end gap-0.5">
                {cell.bars.map((tone, j) => (
                  <span
                    key={j}
                    className={cn(
                      "h-2.5 w-full rounded-sm",
                      tone === "lagoon"
                        ? "bg-pc-turquoise/60"
                        : "bg-pc-coral/60"
                    )}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Locations du jour */}
      <div className="mt-3 space-y-1.5">
        {ROWS.map((row) => (
          <div
            key={row.item}
            className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.05] px-2.5 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-white">
                {row.item}
              </p>
              <p className="truncate text-[9px] text-white/50">{row.detail}</p>
            </div>
            <span
              className={cn(
                "ml-2 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium",
                row.tone
              )}
            >
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
