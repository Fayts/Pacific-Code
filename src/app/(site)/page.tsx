import {
  CalendarCheck,
  MapPin,
  ShieldCheck,
  Sparkles,
  Truck,
  Waves,
} from "lucide-react";
import { ButtonLink, Card, SectionTitle } from "@/components/ui";
import { ProductCard } from "@/components/site/product-card";
import { COMPANY, LOCATIONS, PRESTATIONS } from "@/lib/data";
import { formatXPF } from "@/lib/format";

const STEPS = [
  {
    icon: Sparkles,
    title: "Choisissez",
    text: "Location de matériel professionnel ou prestation à domicile : sélectionnez ce qui vous convient dans le catalogue.",
  },
  {
    icon: CalendarCheck,
    title: "Réservez",
    text: "Choisissez votre date, un créneau horaire, la livraison ou le retrait. Confirmation immédiate.",
  },
  {
    icon: Truck,
    title: "On s'occupe du reste",
    text: "Nous livrons le matériel prêt à l'emploi ou réalisons la prestation chez vous, à l'heure convenue.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ------------------------------- Héro -------------------------------- */}
      <section className="relative overflow-hidden bg-navy-950">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,rgba(12,166,184,0.25),transparent),radial-gradient(40rem_24rem_at_-10%_110%,rgba(12,166,184,0.15),transparent)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-lagoon-500/30 bg-lagoon-500/10 px-4 py-1.5 text-sm font-medium text-lagoon-300">
              <Waves size={15} /> Tahiti · Zone Papenoo – Papeete
            </p>
            <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Des textiles impeccables,{" "}
              <span className="bg-gradient-to-r from-lagoon-300 to-lagoon-500 bg-clip-text text-transparent">
                sans effort
              </span>
              .
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-navy-200">
              Louez un injecteur-extracteur professionnel ou confiez-nous le
              nettoyage de vos canapés, matelas et véhicules. Réservation en
              ligne, livraison à domicile.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/reservation" variant="accent" size="lg">
                Réserver maintenant
              </ButtonLink>
              <ButtonLink
                href="/locations"
                size="lg"
                className="border border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Voir le catalogue
              </ButtonLink>
            </div>
            <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-8 text-white">
              <div>
                <dt className="text-sm text-navy-300">Réservation</dt>
                <dd className="mt-1 font-semibold">100 % en ligne</dd>
              </div>
              <div>
                <dt className="text-sm text-navy-300">Livraison incluse</dt>
                <dd className="mt-1 font-semibold">Papenoo – Papeete</dd>
              </div>
              <div>
                <dt className="text-sm text-navy-300">Matériel</dt>
                <dd className="mt-1 font-semibold">Kärcher Pro</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* --------------------------- Comment ça marche ------------------------ */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionTitle
          eyebrow="Simple et rapide"
          title="Comment ça marche"
          description="Trois étapes suffisent pour retrouver des textiles comme neufs."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Card key={step.title} className="p-7">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lagoon-50 text-lagoon-600">
                  <step.icon size={22} />
                </span>
                <span className="text-4xl font-semibold text-mist-300">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-500">
                {step.text}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* ------------------------------ Locations ----------------------------- */}
      <section className="bg-mist-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionTitle
              align="left"
              eyebrow="Location de matériel"
              title="Faites-le vous-même, avec du matériel pro"
              description="Injecteurs-extracteurs Kärcher livrés prêts à l'emploi, avec détergent et accessoires."
            />
            <ButtonLink href="/locations" variant="outline" className="shrink-0">
              Tout le matériel
            </ButtonLink>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {LOCATIONS.map((item) => (
              <ProductCard key={item.slug} item={item} />
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- Prestations ---------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle
            align="left"
            eyebrow="Prestations à domicile"
            title="Ou laissez faire nos techniciens"
            description="Canapés, matelas, sièges auto : nettoyage en profondeur réalisé chez vous."
          />
          <ButtonLink href="/prestations" variant="outline" className="shrink-0">
            Toutes les prestations
          </ButtonLink>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {PRESTATIONS.map((item) => (
            <ProductCard key={item.slug} item={item} />
          ))}
        </div>
      </section>

      {/* --------------------------- Zone de livraison ------------------------ */}
      <section className="bg-navy-950 py-20 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-lagoon-400">
              Zone de livraison
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Nous venons jusqu&apos;à vous
            </h2>
            <p className="mt-4 leading-relaxed text-navy-200">
              La livraison et la récupération du matériel sont{" "}
              <strong className="text-white">incluses entre Papenoo et Papeete</strong>.
              Au-delà de cette zone, un supplément de{" "}
              <strong className="text-lagoon-300">
                {formatXPF(COMPANY.deliverySurcharge)}
              </strong>{" "}
              s&apos;applique. Vous pouvez aussi retirer le matériel gratuitement
              à notre dépôt de Papeete.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-navy-100">
              <li className="flex items-center gap-3">
                <MapPin size={17} className="shrink-0 text-lagoon-400" />
                Papenoo · Mahina · Arue · Pirae · Papeete — incluse
              </li>
              <li className="flex items-center gap-3">
                <Truck size={17} className="shrink-0 text-lagoon-400" />
                Faa&apos;a · Punaauia · Paea · Papara · Taravao — +{formatXPF(COMPANY.deliverySurcharge)}
              </li>
              <li className="flex items-center gap-3">
                <ShieldCheck size={17} className="shrink-0 text-lagoon-400" />
                Créneaux de 2 h, du lundi au samedi
              </li>
            </ul>
          </div>

          {/* Schéma stylisé de la côte (pas de cliché touristique) */}
          <Card className="border-white/10 bg-white/5 p-8 shadow-none">
            <p className="text-sm font-medium text-navy-200">
              Corridor de livraison — côte nord de Tahiti
            </p>
            <div className="mt-6 space-y-3">
              {["Papenoo", "Mahina", "Arue", "Pirae", "Papeete"].map(
                (commune, i, arr) => (
                  <div key={commune} className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <span className="h-3 w-3 rounded-full bg-lagoon-400" />
                      {i < arr.length - 1 ? (
                        <span className="mt-1 h-5 w-px bg-lagoon-400/40" />
                      ) : null}
                    </div>
                    <span className="text-sm text-white">{commune}</span>
                    <span className="ml-auto text-xs text-lagoon-300">
                      incluse
                    </span>
                  </div>
                )
              )}
              <div className="flex items-center gap-4 border-t border-white/10 pt-3">
                <span className="h-3 w-3 rounded-full border border-navy-300 bg-transparent" />
                <span className="text-sm text-navy-200">Au-delà de la zone</span>
                <span className="ml-auto text-xs text-navy-300">
                  +{formatXPF(COMPANY.deliverySurcharge)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* --------------------------------- CTA -------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <SectionTitle
          title="Prêt à redonner vie à vos textiles ?"
          description="Réservez en 2 minutes. Annulation gratuite jusqu'à 24 h avant."
        />
        <ButtonLink href="/reservation" variant="accent" size="lg" className="mt-8">
          Commencer ma réservation
        </ButtonLink>
      </section>
    </>
  );
}
