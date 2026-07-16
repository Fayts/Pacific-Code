import type { CatalogItem } from "@/lib/types";
import { ProductCard } from "@/components/site/product-card";

export function CatalogPage({
  eyebrow,
  title,
  description,
  items,
  note,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: CatalogItem[];
  note?: string;
}) {
  return (
    <>
      <section className="border-b border-mist-200 bg-mist-50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-lagoon-600">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-navy-500">{description}</p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {items.map((item) => (
            <ProductCard key={item.slug} item={item} />
          ))}
        </div>
        {note ? (
          <p className="mt-10 rounded-2xl bg-lagoon-50 p-5 text-sm leading-relaxed text-lagoon-900">
            {note}
          </p>
        ) : null}
      </section>
    </>
  );
}
