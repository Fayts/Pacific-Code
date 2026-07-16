"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EQUIPMENT_STATUS, type EquipmentDisplayStatus } from "@/lib/core/labels";

const ALL = "all";

// Statuts d'affichage filtrables (hors « archivé », géré par le lien dédié).
const STATUS_FILTERS: EquipmentDisplayStatus[] = [
  "available",
  "reserved",
  "rented",
  "maintenance",
  "unavailable",
];

type ToolbarProps = {
  categories: { id: string; name: string }[];
  q: string;
  category: string;
  status: string;
  archived: boolean;
};

export function EquipmentToolbar({
  categories,
  q,
  category,
  status,
  archived,
}: ToolbarProps) {
  const router = useRouter();

  const buildQuery = (
    overrides: Partial<{ q: string; category: string; status: string; archived: boolean }>
  ) => {
    const next = { q, category, status, archived, ...overrides };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.category) params.set("category", next.category);
    if (next.status) params.set("status", next.status);
    if (next.archived) params.set("archived", "1");
    const qs = params.toString();
    return qs ? `/equipment?${qs}` : "/equipment";
  };

  const categoryItems: Record<string, string> = {
    [ALL]: "Toutes les catégories",
    ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
  };

  const statusItems: Record<string, string> = {
    [ALL]: "Tous les statuts",
    ...Object.fromEntries(STATUS_FILTERS.map((s) => [s, EQUIPMENT_STATUS[s].label])),
  };

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 lg:flex-row lg:items-center">
      <form method="get" action="/equipment" className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher par nom ou référence…"
          className="pl-8"
          aria-label="Rechercher un matériel"
        />
        {category && <input type="hidden" name="category" value={category} />}
        {status && <input type="hidden" name="status" value={status} />}
        {archived && <input type="hidden" name="archived" value="1" />}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={categoryItems}
          value={category || ALL}
          onValueChange={(value) =>
            router.push(buildQuery({ category: value === ALL ? "" : String(value) }))
          }
        >
          <SelectTrigger className="w-full min-w-44 sm:w-auto" aria-label="Filtrer par catégorie">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(categoryItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={statusItems}
          value={status || ALL}
          onValueChange={(value) =>
            router.push(buildQuery({ status: value === ALL ? "" : String(value) }))
          }
        >
          <SelectTrigger className="w-full min-w-40 sm:w-auto" aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(statusItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Link
          href={buildQuery({ archived: !archived, status: "" })}
          className="text-sm whitespace-nowrap text-sky-700 hover:underline"
        >
          {archived ? "Afficher le parc actif" : "Afficher les archivés"}
        </Link>
      </div>
    </div>
  );
}
