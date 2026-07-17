"use client";

// L'onboarding détaillé n'existe plus dans le MVP mock : l'inscription
// configure directement l'entreprise (nom + type d'activité), le reste se
// règle dans Paramètres. On redirige les anciens liens vers le tableau de bord.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}
