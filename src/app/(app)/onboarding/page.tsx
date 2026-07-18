import type { Metadata } from "next";
import { OnboardingClient } from "@/components/onboarding/onboarding-client";

export const metadata: Metadata = {
  title: "Créer mon entreprise rapidement",
};

export default function OnboardingPage() {
  return <OnboardingClient />;
}
