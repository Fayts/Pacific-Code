import type { Metadata } from "next";
import Link from "next/link";
import { Waves } from "lucide-react";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité de Pacific Code : données collectées, usages, conservation, sécurité et droits des utilisateurs.",
};

// Page publique exigée notamment par la revue d'application Meta.
// Le lien « Suppression des données » (#suppression) sert aussi de
// « Data Deletion Instructions URL » dans les paramètres de l'app Meta.

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPolicyPage() {
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
        Politique de confidentialité
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : 21 juillet 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
        <Section title="1. Qui sommes-nous">
          <p>
            Pacific Code est un logiciel de gestion de location (matériel,
            véhicules, nautisme, événementiel) édité en Polynésie française et
            destiné aux entreprises de location (« les loueurs »). Il centralise
            leur catalogue, leurs clients, leurs réservations et les demandes
            reçues sur leurs canaux de communication connectés (Facebook
            Messenger, email, formulaire public).
          </p>
          <p>
            Responsable de la plateforme : Pacific Code — Polynésie française.
            Contact :{" "}
            <a
              href="mailto:pacificrentclean@gmail.com"
              className="text-primary hover:underline"
            >
              pacificrentclean@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="2. Les rôles : loueur responsable, Pacific Code sous-traitant">
          <p>
            Chaque loueur reste responsable des données de ses propres clients
            (noms, coordonnées, réservations, messages). Pacific Code agit comme
            sous-traitant technique : la plateforme traite ces données pour le
            compte du loueur, uniquement afin de fournir le service, et chaque
            entreprise est strictement isolée des autres.
          </p>
        </Section>

        <Section title="3. Données collectées">
          <p>Selon l&apos;utilisation du service, sont traitées :</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Compte du loueur</strong> : nom, prénom, adresse email,
              mot de passe (chiffré), informations de l&apos;entreprise (nom,
              coordonnées, fuseau horaire, devise).
            </li>
            <li>
              <strong>Données métier saisies par le loueur</strong> : catalogue
              de matériel, fiches clients, réservations, notes internes.
            </li>
            <li>
              <strong>Messages des canaux connectés</strong> : lorsque le loueur
              connecte sa Page Facebook, Pacific Code reçoit les messages
              envoyés à cette Page via Messenger, ainsi que le nom public et
              l&apos;identifiant technique (PSID) de l&apos;expéditeur, fournis
              par Meta. Ces données servent exclusivement à afficher la
              conversation au loueur et à lui permettre d&apos;y répondre.
            </li>
            <li>
              <strong>Assistant IA</strong> : les questions posées à
              l&apos;assistant et les messages analysés peuvent être transmis à
              un fournisseur d&apos;intelligence artificielle (Anthropic) pour
              générer une réponse. Ils ne sont pas utilisés pour entraîner des
              modèles.
            </li>
          </ul>
        </Section>

        <Section title="4. Finalités">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Fournir le service de gestion de location au loueur ;</li>
            <li>
              Centraliser les demandes reçues sur ses canaux connectés et
              l&apos;aider à y répondre (y compris avec des réponses préparées
              par l&apos;assistant IA, toujours fondées sur ses données réelles) ;
            </li>
            <li>Assurer la sécurité et le bon fonctionnement de la plateforme.</li>
          </ul>
          <p>
            Aucune donnée n&apos;est vendue, louée ni utilisée à des fins
            publicitaires.
          </p>
        </Section>

        <Section title="5. Hébergement et sécurité">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Données stockées chez Supabase (base PostgreSQL sécurisée,
              chiffrement au repos et en transit, région us-west-1).
            </li>
            <li>
              Isolation stricte par entreprise (règles de sécurité au niveau de
              la base de données : un loueur ne peut jamais accéder aux données
              d&apos;un autre).
            </li>
            <li>
              Les jetons d&apos;accès aux canaux connectés (ex. jeton de Page
              Facebook) sont stockés côté serveur uniquement et ne transitent
              jamais par le navigateur.
            </li>
          </ul>
        </Section>

        <Section title="6. Sous-traitants techniques">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Supabase (hébergement de la base de données et authentification) ;</li>
            <li>Anthropic (génération des réponses de l&apos;assistant IA) ;</li>
            <li>
              Meta Platforms (réception et envoi des messages Messenger, dans le
              cadre des autorisations accordées par le loueur).
            </li>
          </ul>
        </Section>

        <Section title="7. Conservation">
          <p>
            Les données sont conservées tant que le compte du loueur est actif.
            Les conversations et données métier peuvent être supprimées à tout
            moment par le loueur depuis l&apos;application. À la clôture d&apos;un
            compte, l&apos;ensemble des données de l&apos;entreprise est supprimé.
          </p>
        </Section>

        <Section title="8. Suppression des données et droits" id="suppression">
          <p>
            Conformément à la réglementation applicable en Polynésie française
            (loi Informatique et Libertés / RGPD), toute personne peut demander
            l&apos;accès, la rectification ou la <strong>suppression</strong> des
            données la concernant :
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Vous êtes loueur</strong> : écrivez-nous à{" "}
              <a
                href="mailto:pacificrentclean@gmail.com"
                className="text-primary hover:underline"
              >
                pacificrentclean@gmail.com
              </a>{" "}
              depuis l&apos;adresse email de votre compte — suppression complète
              de votre espace sous 30 jours.
            </li>
            <li>
              <strong>Vous avez écrit à une Page connectée via Messenger</strong>{" "}
              : adressez votre demande au loueur concerné (responsable de vos
              données), ou écrivez-nous en précisant le nom de la Page — les
              messages et identifiants associés seront supprimés sous 30 jours.
            </li>
          </ul>
        </Section>

        <Section title="9. Évolution de cette politique">
          <p>
            Cette politique peut évoluer avec le service ; la date de mise à
            jour figure en haut de page. Les changements importants seront
            signalés dans l&apos;application.
          </p>
        </Section>

        <p className="border-t border-border pt-6 text-xs text-muted-foreground">
          Voir aussi :{" "}
          <Link href="/conditions" className="text-primary hover:underline">
            Conditions d&apos;utilisation
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