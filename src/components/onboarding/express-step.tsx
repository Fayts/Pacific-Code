"use client";

import {
  Car,
  Home,
  Layers,
  Package,
  Bike,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";

// Démarrage express : structure de départ par type d’activité.
// Uniquement des catégories et des suggestions — jamais de faux biens
// ni de faux prix.
const TEMPLATES: Array<{
  id: string;
  icon: LucideIcon;
  title: string;
  text: string;
  categories: string[];
}> = [
  {
    id: "vehicles",
    icon: Car,
    title: "Location de véhicules",
    text: "Voitures, 4x4, utilitaires — fiches individuelles par véhicule.",
    categories: ["Voitures", "4x4 et utilitaires", "Accessoires"],
  },
  {
    id: "scooters",
    icon: Bike,
    title: "Location de scooters",
    text: "Scooters et deux-roues, avec casques et équipements.",
    categories: ["Scooters", "Casques et équipements"],
  },
  {
    id: "equipment",
    icon: Package,
    title: "Location de matériel",
    text: "Nettoyage, bricolage, jardin — gestion par stock.",
    categories: ["Nettoyage", "Bricolage", "Jardin", "Autre matériel"],
  },
  {
    id: "housing",
    icon: Home,
    title: "Location de logements",
    text: "Bungalows, studios, fare — une fiche par logement.",
    categories: ["Logements"],
  },
  {
    id: "mixed",
    icon: Layers,
    title: "Activité mixte",
    text: "Un peu de tout : la structure complète, à élaguer ensuite.",
    categories: ["Véhicules", "Scooters", "Matériel", "Nautique", "Événementiel", "Autre"],
  },
];

export function ExpressStep({
  onSelect,
}: {
  onSelect: (templateTitle: string, categories: string[]) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-5 text-center text-sm text-muted-foreground">
        Choisissez votre type d’activité : les catégories et réglages de départ
        seront préparés. Ce sont des suggestions — aucun bien fictif ne sera
        créé.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((template, i) => {
          const Icon = template.icon;
          return (
            <motion.button
              key={template.id}
              type="button"
              onClick={() => onSelect(template.title, template.categories)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * i }}
              className="group flex flex-col rounded-2xl bg-card p-5 text-left shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08] transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-pc-deep/10 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-lagoon/25 transition duration-300 group-hover:scale-110">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                {template.title}
              </h3>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
                {template.text}
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground/70">
                {template.categories.join(" · ")}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
