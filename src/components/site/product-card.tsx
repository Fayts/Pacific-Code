import Link from "next/link";
import { ArrowRight, Clock, ShieldCheck } from "lucide-react";
import type { CatalogItem } from "@/lib/types";
import { formatXPF } from "@/lib/format";
import { Badge, Card } from "@/components/ui";
import { ProductVisual } from "@/components/product-visual";

export function ProductCard({ item }: { item: CatalogItem }) {
  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-[0_8px_30px_rgba(10,37,64,0.12)]">
      <Link href={`/produit/${item.slug}`} className="flex h-full flex-col">
        <ProductVisual item={item} className="h-44" />
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-center gap-2">
            <Badge tone={item.category === "location" ? "navy" : "lagoon"}>
              {item.category === "location" ? "Location" : "Prestation"}
            </Badge>
            {item.popular ? <Badge tone="amber">Populaire</Badge> : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-navy-900">{item.name}</h3>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-navy-500">
            {item.shortDescription}
          </p>

          <div className="mt-3 flex items-center gap-3 text-xs text-navy-400">
            {item.duration ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={13} /> {item.duration}
              </span>
            ) : null}
            {item.deposit ? (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck size={13} /> Caution {formatXPF(item.deposit)}
              </span>
            ) : null}
          </div>

          <div className="mt-auto flex items-end justify-between pt-4">
            <p>
              <span className="text-xl font-semibold text-navy-900">
                {formatXPF(item.price)}
              </span>
              <span className="ml-1 text-sm text-navy-400">{item.priceUnit}</span>
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-lagoon-600 transition-transform group-hover:translate-x-0.5">
              Voir <ArrowRight size={15} />
            </span>
          </div>
        </div>
      </Link>
    </Card>
  );
}
