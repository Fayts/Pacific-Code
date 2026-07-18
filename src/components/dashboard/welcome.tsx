import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarPlus, PackagePlus, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STEPS: {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Ajouter votre matériel",
    description:
      "Renseignez vos équipements, leurs tarifs journaliers et les quantités disponibles.",
    href: "/equipment/new",
    cta: "Ajouter un matériel",
    icon: PackagePlus,
  },
  {
    title: "Créer un client",
    description:
      "Enregistrez vos clients particuliers ou professionnels avec leurs coordonnées.",
    href: "/customers/new",
    cta: "Créer un client",
    icon: UserPlus,
  },
  {
    title: "Créer votre première réservation",
    description:
      "Associez un client à du matériel sur une période : le planning se met à jour tout seul.",
    href: "/bookings/new",
    cta: "Créer une réservation",
    icon: CalendarPlus,
  },
];

export function WelcomeScreen() {
  return (
    <div className="mx-auto max-w-2xl py-6 md:py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Bienvenue sur Pacific Code 👋
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Votre espace est prêt. Trois étapes suffisent pour démarrer la
          gestion de vos locations.
        </p>
      </div>

      {/* Voie rapide : import automatisé de l'activité */}
      <Link
        href="/onboarding"
        className="group mt-8 flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-pc-night via-pc-deep to-pc-lagoon p-6 text-white shadow-xl shadow-pc-deep/20 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl sm:flex-row sm:items-center"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm transition duration-300 group-hover:scale-110">
          <Sparkles className="size-5 text-pc-turquoise" aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">
            Importer mon activité en quelques minutes
          </span>
          <span className="mt-0.5 block text-sm text-white/70">
            Fichier, annonces collées ou assistant IA : votre catalogue se
            construit tout seul, vous validez avant création.
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-pc-deep transition group-hover:bg-pc-mist">
          Commencer →
        </span>
      </Link>

      <p className="mt-6 mb-3 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground/70">
        ou pas à pas
      </p>

      <div className="space-y-3">
        {STEPS.map((step, index) => (
          <Card key={step.href}>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-start gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-sm font-semibold text-white shadow-lg shadow-pc-turquoise/25">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">
                    {step.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
              <div className="shrink-0 pl-12 sm:pl-0">
                <Button
                  variant={index === 0 ? "default" : "outline"}
                  render={<Link href={step.href} />}
                >
                  <step.icon aria-hidden />
                  {step.cta}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
