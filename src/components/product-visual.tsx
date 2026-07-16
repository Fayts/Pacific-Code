import { BedDouble, Package, Sofa, Waves } from "lucide-react";
import type { CatalogItem } from "@/lib/types";
import { cn } from "@/components/ui";

const ICONS = {
  machine: Waves,
  pack: Package,
  sofa: Sofa,
  bed: BedDouble,
};

/**
 * Visuel produit stylisé (pas de photos dans la maquette) :
 * dégradé de marque + icône, remplacé plus tard par de vraies photos.
 */
export function ProductVisual({
  item,
  className,
  iconSize = 56,
}: {
  item: CatalogItem;
  className?: string;
  iconSize?: number;
}) {
  const Icon = ICONS[item.icon];
  const isLocation = item.category === "location";
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        isLocation
          ? "bg-gradient-to-br from-navy-900 via-navy-800 to-lagoon-800"
          : "bg-gradient-to-br from-lagoon-600 via-lagoon-700 to-navy-900",
        className
      )}
      aria-hidden
    >
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5" />
      <div className="absolute -bottom-14 -left-8 h-48 w-48 rounded-full bg-white/5" />
      <Icon size={iconSize} strokeWidth={1.25} className="text-white/90" />
    </div>
  );
}
