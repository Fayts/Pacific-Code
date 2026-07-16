import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Check,
  ChevronRight,
  Clock,
  MapPin,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { ProductVisual } from "@/components/product-visual";
import { ProductCard } from "@/components/site/product-card";
import { CATALOG, COMPANY, getItem } from "@/lib/data";
import { formatXPF } from "@/lib/format";

export function generateStaticParams() {
  return CATALOG.map((item) => ({ slug: item.slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = getItem(slug);
  if (!item) notFound();

  const isLocation = item.category === "location";
  const others = CATALOG.filter((i) => i.slug !== item.slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-1.5 text-sm text-navy-400">
        <Link href="/" className="hover:text-navy-700">Accueil</Link>
        <ChevronRight size={14} />
        <Link
          href={isLocation ? "/locations" : "/prestations"}
          className="hover:text-navy-700"
        >
          {isLocation ? "Locations" : "Prestations"}
        </Link>
        <ChevronRight size={14} />
        <span className="text-navy-700">{item.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        {/* Visuel + points forts */}
        <div>
          <ProductVisual
            item={item}
            iconSize={96}
            className="h-72 rounded-3xl sm:h-96"
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {item.features.map((feature) => (
              <div
                key={feature}
                className="flex items-start gap-2.5 rounded-xl bg-mist-50 p-3.5 text-sm text-navy-700"
              >
                <Check size={16} className="mt-0.5 shrink-0 text-lagoon-600" />
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Infos et réservation */}
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={isLocation ? "navy" : "lagoon"}>
              {isLocation ? "Location" : "Prestation"}
            </Badge>
            {item.popular ? <Badge tone="amber">Populaire</Badge> : null}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
            {item.name}
          </h1>
          <p className="mt-4 leading-relaxed text-navy-500">{item.description}</p>

          <Card className="mt-6 p-6">
            <div className="flex items-end justify-between">
              <p>
                <span className="text-3xl font-semibold text-navy-900">
                  {formatXPF(item.price)}
                </span>
                <span className="ml-1.5 text-navy-400">{item.priceUnit}</span>
              </p>
              {item.deposit ? (
                <p className="text-sm text-navy-400">
                  Caution : {formatXPF(item.deposit)}
                </p>
              ) : null}
            </div>

            <ul className="mt-5 space-y-2.5 border-t border-mist-200 pt-5 text-sm text-navy-600">
              {item.duration ? (
                <li className="flex items-center gap-2.5">
                  <Clock size={16} className="text-lagoon-600" />
                  Durée : {item.duration}
                </li>
              ) : null}
              <li className="flex items-center gap-2.5">
                <Truck size={16} className="text-lagoon-600" />
                {COMPANY.deliveryZone}
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin size={16} className="text-lagoon-600" />
                Supplément {formatXPF(COMPANY.deliverySurcharge)} au-delà de la zone
              </li>
              <li className="flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-lagoon-600" />
                Annulation gratuite jusqu&apos;à 24 h avant
              </li>
            </ul>

            <ButtonLink
              href={`/reservation?produit=${item.slug}`}
              variant="accent"
              size="lg"
              className="mt-6 w-full"
            >
              Réserver {isLocation ? "ce matériel" : "cette prestation"}
            </ButtonLink>
            <p className="mt-3 text-center text-xs text-navy-400">
              Confirmation immédiate · Paiement à la livraison ou en ligne
            </p>
          </Card>

          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-400">
              Ce qui est inclus
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-navy-600">
              {item.included.map((inc) => (
                <li key={inc} className="flex items-center gap-2.5">
                  <Check size={15} className="shrink-0 text-lagoon-600" />
                  {inc}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      <div className="mt-20">
        <h2 className="text-2xl font-semibold tracking-tight text-navy-900">
          Vous aimerez aussi
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((other) => (
            <ProductCard key={other.slug} item={other} />
          ))}
        </div>
      </div>
    </div>
  );
}
