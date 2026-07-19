// État d'activation de l'entreprise : checklist d'onboarding et détection
// d'un espace non configuré. Source unique pour le dashboard et la sidebar.

import type {
  Customer,
  EquipmentItem,
  Organization,
} from "@/lib/types/database";

export type OnboardingStep = {
  id: "business" | "catalog" | "pricing" | "public_link" | "customer_form";
  label: string;
  href: string;
  done: boolean;
};

export type OnboardingProgress = {
  steps: OnboardingStep[];
  doneCount: number;
  totalCount: number;
  /** 0 → 1 */
  ratio: number;
  completed: boolean;
};

export function computeOnboardingProgress(
  organization: Organization,
  equipment: EquipmentItem[],
  customers: Customer[]
): OnboardingProgress {
  const activeEquipment = equipment.filter((e) => !e.archived_at);
  const activeCustomers = customers.filter((c) => !c.archived_at);

  const steps: OnboardingStep[] = [
    {
      id: "business",
      label: "Informations de l'entreprise",
      href: "/settings",
      done: Boolean(
        organization.phone || organization.email || organization.address
      ),
    },
    {
      id: "catalog",
      label: "Catalogue importé",
      href: "/onboarding",
      done: activeEquipment.length > 0,
    },
    {
      id: "pricing",
      label: "Tarifs vérifiés",
      href: "/equipment",
      done:
        activeEquipment.length > 0 &&
        activeEquipment.every((e) => e.daily_price > 0),
    },
    {
      id: "public_link",
      label: "Lien public activé",
      href: "/reserver/apercu",
      done: organization.onboarding_completed_at !== null,
    },
    {
      id: "customer_form",
      label: "Formulaire client testé",
      href: "/customers/new",
      done: activeCustomers.length > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  return {
    steps,
    doneCount,
    totalCount: steps.length,
    ratio: doneCount / steps.length,
    completed: doneCount === steps.length,
  };
}

/**
 * Espace « non configuré » : onboarding jamais terminé ET aucune donnée.
 * C'est le déclencheur de l'écran d'activation à la place du dashboard.
 */
export function isBusinessUnconfigured(
  organization: Organization,
  equipment: EquipmentItem[],
  customers: Customer[],
  bookingCount: number
): boolean {
  return (
    organization.onboarding_completed_at === null &&
    equipment.length === 0 &&
    customers.length === 0 &&
    bookingCount === 0
  );
}
