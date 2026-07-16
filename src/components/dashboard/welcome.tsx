import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarPlus, PackagePlus, UserPlus } from "lucide-react";
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
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
          Votre espace est prêt. Trois étapes suffisent pour démarrer la
          gestion de vos locations.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {STEPS.map((step, index) => (
          <Card key={step.href}>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-start gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-700 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-neutral-900">
                    {step.title}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
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
