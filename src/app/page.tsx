import type { Metadata } from "next";
import { LandingShell } from "@/components/landing/landing-shell";
import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { ActivitySection } from "@/components/landing/activity";
import { ChaosSection } from "@/components/landing/chaos";
import { JourneySection } from "@/components/landing/journey";
import { FeaturesSection } from "@/components/landing/features";
import { FenuaSection } from "@/components/landing/fenua";
import { BenefitsSection } from "@/components/landing/benefits";
import { FinalCtaSection } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";

export const metadata: Metadata = {
  description:
    "Pacific Code — gérez vos locations sans perdre votre temps. Véhicules, matériels ou logements : réservations, clients, contrats et paiements réunis dans un seul espace, pensé pour la Polynésie française.",
};

// Landing V1 : maquette narrative au scroll, données fictives locales.
export default function HomePage() {
  return (
    <LandingShell>
      <div className="bg-pc-night text-neutral-900">
        <LandingNav />
        <main>
          <Hero />
          <ActivitySection />
          <ChaosSection />
          <JourneySection />
          <FeaturesSection />
          <FenuaSection />
          <BenefitsSection />
          <FinalCtaSection />
        </main>
        <LandingFooter />
      </div>
    </LandingShell>
  );
}
