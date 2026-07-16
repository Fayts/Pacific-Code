import type { CatalogItem } from "@/lib/types";
import { formatXPF } from "@/lib/format";
import { Badge, Button, Card } from "@/components/ui";
import { ProductVisual } from "@/components/product-visual";

/** Grille d'administration du catalogue (produits ou prestations) */
export function CatalogAdminGrid({ items }: { items: CatalogItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card key={item.slug} className="overflow-hidden">
          <ProductVisual item={item} className="h-24" iconSize={32} />
          <div className="p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-navy-900">{item.name}</p>
              <Badge tone="green">En ligne</Badge>
            </div>
            <p className="mt-1 text-sm text-navy-500">
              {formatXPF(item.price)}{" "}
              <span className="text-navy-400">{item.priceUnit}</span>
              {item.deposit ? (
                <span className="block text-xs text-navy-400">
                  Caution : {formatXPF(item.deposit)}
                </span>
              ) : null}
              {item.duration ? (
                <span className="block text-xs text-navy-400">
                  Durée : {item.duration}
                </span>
              ) : null}
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                Modifier
              </Button>
              <Button variant="ghost" size="sm">
                Dupliquer
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
