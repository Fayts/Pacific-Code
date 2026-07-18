"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CustomerType } from "@/lib/types/database";

type Filters = {
  q: string;
  type: CustomerType | "all";
  archived: boolean;
};

const TYPE_ITEMS = [
  { value: "all", label: "Tous les types" },
  { value: "individual", label: "Particuliers" },
  { value: "company", label: "Professionnels" },
];

/** Barre de recherche + filtres de la liste des clients (synchronisés avec l'URL). */
export function CustomersFilters({ q, type, archived }: Filters) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(q);

  const apply = (next: Partial<Filters>) => {
    const qv = (next.q ?? q).trim();
    const tv = next.type ?? type;
    const av = next.archived ?? archived;

    const params = new URLSearchParams();
    if (qv) params.set("q", qv);
    if (tv !== "all") params.set("type", tv);
    if (av) params.set("archived", "1");
    const qs = params.toString();

    startTransition(() => {
      router.replace(qs ? `/customers?${qs}` : "/customers");
    });
  };

  // Recherche avec léger débounce pour éviter une requête par frappe.
  useEffect(() => {
    if (search.trim() === q) return;
    const timer = setTimeout(() => apply({ q: search }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center gap-3 transition-opacity",
        pending && "opacity-70"
      )}
    >
      <div className="relative w-full sm:w-72">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground/70"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher nom, société, email, téléphone…"
          className="bg-card pl-8"
          aria-label="Rechercher un client"
        />
      </div>

      <Select
        items={TYPE_ITEMS}
        value={type}
        onValueChange={(v) => apply({ type: (v as Filters["type"]) ?? "all" })}
      >
        <SelectTrigger className="w-44 bg-card" aria-label="Filtrer par type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPE_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Switch
          id="customers-archived"
          checked={archived}
          onCheckedChange={(checked) => apply({ archived: checked })}
        />
        <Label
          htmlFor="customers-archived"
          className="text-sm font-normal text-muted-foreground"
        >
          Clients archivés
        </Label>
      </div>
    </div>
  );
}
