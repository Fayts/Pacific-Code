// Visite guidée : registre déclaratif des étapes.
// La visite PRÉSENTE les fonctionnalités — elle ne demande jamais
// d'action et ne crée jamais de donnée. Chaque étape met en lumière un
// élément permanent de l'interface (navigation, barre supérieure) :
// aucun changement de page n'est nécessaire, la visite dure moins
// d'une minute. Ajouter une étape = une entrée ici (+ un attribut
// data-guide sur l'élément visé si besoin).

import {
  Calendar,
  CalendarCheck,
  CircleHelp,
  LayoutDashboard,
  Package,
  PackageOpen,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export type TourStep = {
  id: string;
  title: string;
  /** Une phrase maximum. */
  text: string;
  icon: LucideIcon;
  /** Élément mis en lumière (attribut data-guide). */
  selector: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard",
    title: "Tableau de bord",
    text: "Votre activité du jour en un coup d’œil : départs, retours et retards.",
    icon: LayoutDashboard,
    selector: '[data-guide="/dashboard"]',
  },
  {
    id: "bookings",
    title: "Réservations",
    text: "Gérez ici toutes vos réservations et suivez leur statut en temps réel.",
    icon: CalendarCheck,
    selector: '[data-guide="/bookings"]',
  },
  {
    id: "calendar",
    title: "Calendrier",
    text: "Visualisez départs et retours — les conflits sont détectés automatiquement.",
    icon: Calendar,
    selector: '[data-guide="/calendar"]',
  },
  {
    id: "equipment",
    title: "Matériel",
    text: "Vos biens, leurs tarifs et leur disponibilité, réunis au même endroit.",
    icon: Package,
    selector: '[data-guide="/equipment"]',
  },
  {
    id: "customers",
    title: "Clients",
    text: "Chaque client et son historique de locations, sans rien chercher.",
    icon: Users,
    selector: '[data-guide="/customers"]',
  },
  {
    id: "assistant",
    title: "Assistant IA",
    text: "Posez vos questions en français : il connaît toute votre activité.",
    icon: Sparkles,
    selector: '[data-guide="/assistant"]',
  },
  {
    id: "settings",
    title: "Paramètres",
    text: "Votre entreprise, vos formats et la numérotation de vos réservations.",
    icon: Settings,
    selector: '[data-guide="/settings"]',
  },
  {
    id: "import",
    title: "Import de l’activité",
    text: "Créez ou mettez à jour tout votre catalogue en quelques minutes (Ctrl + I).",
    icon: PackageOpen,
    selector: '[data-guide="import-action"]',
  },
  {
    id: "public-form",
    title: "Formulaire client public",
    text: "Vos clients réservent seuls via votre lien — retrouvez-le dans ce centre d’aide.",
    icon: CircleHelp,
    selector: '[data-guide="help-menu"]',
  },
];
