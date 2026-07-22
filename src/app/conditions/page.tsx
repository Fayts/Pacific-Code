import type { Metadata } from "next";
import Link from "next/link";
import { Waves } from "lucide-react";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description:
    "Conditions d'utilisation de Pacific Code, logiciel de gestion de location conçu en Polynésie française.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white">
          <Waves className="size-4" aria-hidden />
        </span>
        Pacific Code
      </Link>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
        Conditions d&apos;utilisation
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : 21 juillet 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
        <Section title="1. Le service">
          <p>
            Pacific Code est un logiciel en ligne de gestion de location destiné
            aux professionnels : catalogue de matériel, clients, réservations,
            calendrier, boîte de réception multicanale (Messenger, email,
            formulaire) et assistant IA. Le service est édité en Polynésie
            française.
          </p>
        </Section>

        <Section title="2. Compte et responsabilités du loueur">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Le loueur est responsable de la confidentialité de ses
              identifiants et des actions réalisées depuis son compte.
            </li>
            <li>
              Il garantit disposer des droits nécessaires sur les canaux
              qu&apos;il connecte (notamment être administrateur de sa Page
              Facebook) et sur les données qu&apos;il importe.
            </li>
            <li>
              Il reste seul responsable de ses relations commerciales avec ses
              propres clients (tarifs, contrats, cautions, litiges).
            </li>
          </ul>
        </Section>

        <Section title="3. Assistant IA">
          <p>
            L&apos;assistant prépare des analyses et des réponses fondées sur les
            données du loueur. Les réponses automatiques ne concernent que les
            demandes simples et peuvent être désactivées ; les actions
            importantes (réservations, envois) requièrent une validation
            humaine, sauf activation explicite du mode automatique par le
            loueur. L&apos;assistant peut commettre des erreurs : le loueur reste
            responsable des messages envoyés depuis son compte.
          </p>
        </Section>

        <Section title="4. Disponibilité">
          <p>
            Le service est fourni « en l&apos;état », avec des interruptions
            possibles pour maintenance. Les canaux tiers (Meta, fournisseurs
            d&apos;email) peuvent imposer leurs propres limites ou
            indisponibilités, indépendantes de Pacific Code.
          </p>
        </Section>

        <Section title="5. Données">
          <p>
            Le traitement des données est décrit dans la{" "}
            <Link
              href="/confidentialite"
              className="text-primary hover:underline"
            >
              politique de confidentialité
            </Link>
            . À la clôture du compte, les données de l&apos;entreprise sont
            supprimées.
          </p>
        </Section>

        <Section title="6. Usage acceptable">
          <p>
            Il est interdit d&apos;utiliser Pacific Code pour envoyer des
            messages non sollicités (spam), contourner les règles des
            plateformes connectées, ou traiter des contenus illicites. Le
            non-respect peut entraîner la suspension du compte.
          </p>
        </Section>

        <Section title="7. Contact">
          <p>
            Pour toute question :{" "}
            <a
              href="mailto:fayts987@gmail.com"
              className="text-primary hover:underline"
            >
              fayts987@gmail.com
            </a>
            .
          </p>
        </Section>

        <p className="border-t border-border pt-6 text-xs text-muted-foreground">
          Voir aussi :{" "}
          <Link href="/confidentialite" className="text-primary hover:underline">
            Politique de confidentialité
          </Link>
          {" · "}
          <Link href="/" className="text-primary hover:underline">
            Retour à l&apos;accueil
          </Link>
        </p>
      </div>
    </main>
  );
}