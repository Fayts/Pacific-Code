# Pacific Code

Assistant de gestion pour les entreprises de location — matériel, véhicules, nautique, événementiel. Première version (MVP) construite pour le client pilote **Pacific Rent&Clean** (location de matériel de nettoyage, Polynésie française).

Pacific Code remplace les outils dispersés (Google Calendar, Excel, WhatsApp, contrats Word, notes papier) par une seule application : catalogue, clients, réservations, disponibilités, tableau de bord et assistant IA connecté aux données.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Installation](#installation)
- [Configuration Supabase](#configuration-supabase)
- [Configuration de l'assistant IA](#configuration-de-lassistant-ia)
- [Commandes](#commandes)
- [Compte de démonstration](#compte-de-démonstration)
- [Architecture](#architecture)
- [Sécurité](#sécurité)
- [Tests](#tests)
- [Limites connues](#limites-connues)
- [Feuille de route V2](#feuille-de-route-v2)

---

## Fonctionnalités

### ✅ Réalisées dans ce MVP

| Module | Contenu |
|---|---|
| **Authentification** | Inscription, connexion, mot de passe oublié/réinitialisation, confirmation email |
| **Onboarding** | Configuration initiale de l'entreprise : nom, type d'activité, devise (XPF par défaut), fuseau horaire (Pacific/Tahiti par défaut), préfixe de numérotation |
| **Multi-tenant** | Chaque entreprise est isolée par Row Level Security PostgreSQL — prêt pour plusieurs entreprises |
| **Tableau de bord** | Départs/retours du jour, locations en cours, retards, CA estimé du mois, résumé du parc, prochaines opérations, actions rapides, état vide de bienvenue |
| **Matériel** | Catalogue avec photos, catégories, prix journalier, caution, quantités multiples, durée minimale, statuts (dispo/réservé/en location/maintenance/indisponible/archivé), recherche/filtres, fiche détaillée avec historique et CA généré, duplication, archivage logique |
| **Clients** | Particuliers et professionnels, recherche/filtres, fiche avec historique, total dépensé, archivage logique |
| **Réservations** | Numérotation automatique (PRC-2026-0001), création guidée (client → matériels → dates → disponibilité → prix), **détection des conflits en temps réel avec raison affichée**, calcul automatique durée/prix, remise et frais, caution, statuts (brouillon → à confirmer → confirmée → en cours → terminée / annulée / **en retard** dérivé), états de paiement et de caution, chronologie des changements, duplication, modification |
| **Anti double réservation** | Vérification transactionnelle côté PostgreSQL (verrous consultatifs par matériel) : deux créations simultanées ne peuvent pas réserver le même exemplaire |
| **Calendrier** | Vue mois et semaine, couleurs par statut, filtres matériel/statut, détection visuelle des conflits, clic → fiche réservation |
| **Assistant IA** | Connecté aux données de l'entreprise via des outils validés (jamais de SQL libre). Lecture : disponibilités, réservations, clients, stats, retards, maintenance. Actions **préparées puis confirmées par l'utilisateur** : réservation, client, statut matériel. **Mode démonstration sans clé API** (réponses déterministes sur vos vraies données) |
| **Paramètres** | Informations entreprise, logo, devise, fuseau, format de date, préfixe de réservation |
| **Qualité** | TypeScript strict, validation Zod partout, RLS, journalisation des actions (activity_logs), états vides/chargement, confirmations avant actions sensibles, protection double soumission |

### ❌ Volontairement hors périmètre (voir [Feuille de route V2](#feuille-de-route-v2))

Paiements Stripe, contrats PDF, signature électronique, marketplace, tarifs saisonniers/horaires, SMS, synchronisation Airbnb/Booking, application mobile native, facturation légale, état des lieux photo.

---

## Stack technique

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript strict**
- **Tailwind CSS v4** + **shadcn/ui** (Base UI)
- **Supabase** : PostgreSQL 17, Auth, Storage, Row Level Security
- **react-hook-form** + **Zod 4** (validation client ET serveur)
- **date-fns 4** + helpers de fuseau horaire maison (Intl)
- **AI SDK** + adaptateurs **Anthropic / OpenAI / Google** (couche d'abstraction fournisseur)
- **Vitest** (tests unitaires)

---

## Installation

### Prérequis

- Node.js ≥ 20.9
- Un projet [Supabase](https://supabase.com) (gratuit)

### Étapes

```bash
git clone <votre-repo> pacific-code
cd pacific-code
npm install
cp .env.example .env.local   # puis renseigner les valeurs (voir ci-dessous)
npm run dev                   # → http://localhost:3000
```

---

## Configuration Supabase

### 1. Créer le projet

Créez un projet sur [supabase.com](https://supabase.com) et récupérez dans **Project Settings → API** :

- l'URL du projet → `NEXT_PUBLIC_SUPABASE_URL`
- la clé publique (publishable `sb_publishable_...` ou anon) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> Le projet pilote est déjà provisionné : `https://buunophxfugbtkvdyfer.supabase.co` (org « Pacific Code », région us-west-1). Le `.env.local` du dépôt le référence déjà.

### 2. Appliquer les migrations

Dans le **SQL Editor** du dashboard Supabase, exécutez dans l'ordre les fichiers de `supabase/migrations/` :

1. `20260715000001_initial_schema.sql` — tables, index, triggers
2. `20260715000002_functions.sql` — fonctions métier (disponibilité, numérotation, création d'organisation)
3. `20260715000003_rls.sql` — Row Level Security + buckets de stockage
4. `20260715000004_booking_transactions.sql` — création/modification de réservation atomiques
5. `20260715000005_harden_functions.sql` — révocation des exécutions anonymes
6. `20260715000006_review_hardening.sql` — contrôles d'appartenance client/matériel, politiques resserrées

*(1 à 5 déjà appliquées sur le projet pilote ; **la n°6 reste à exécuter** dans le SQL Editor.)*

### 3. Données de démonstration (facultatif)

Exécutez `supabase/seed.sql` dans le SQL Editor. Le script est idempotent et crée l'entreprise **Pacific Rent&Clean** complète (matériels, clients, réservations en cours/en retard/à venir). *(Déjà appliqué sur le projet pilote.)*

### 4. Authentification

- **Pour tester sans emails** : Dashboard → Authentication → Sign In / Up → Email → désactivez « Confirm email ». Sinon, configurez un SMTP (Authentication → Emails) pour recevoir les liens de confirmation.
- Dans **Authentication → URL Configuration**, ajoutez votre URL (ex. `http://localhost:3000`) dans *Site URL* et *Redirect URLs* (`http://localhost:3000/auth/callback`).

---

## Configuration de l'assistant IA

L'assistant fonctionne **sans aucune clé** en mode démonstration (réponses déterministes construites sur vos vraies données : disponibilités, retards, stats, préparation de réservation).

Pour activer un vrai modèle, renseignez dans `.env.local` :

```bash
AI_PROVIDER=anthropic          # anthropic | openai | google | demo
ANTHROPIC_API_KEY=sk-ant-...   # la clé du fournisseur choisi
# AI_MODEL=claude-opus-4-8     # facultatif, modèle par défaut par fournisseur
```

Modèles par défaut : Anthropic → `claude-opus-4-8`, OpenAI → `gpt-4o`, Google → `gemini-2.5-flash`.

L'IA n'accède aux données **que** par des outils validés et scopés à l'entreprise, et ne peut **jamais** modifier quoi que ce soit sans confirmation explicite de l'utilisateur dans l'interface.

---

## Commandes

```bash
npm run dev         # serveur de développement (http://localhost:3000)
npm run build       # build de production
npm run start       # servir le build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # tests unitaires (vitest)
```

---

## Compte de démonstration

Après application du seed :

| | |
|---|---|
| **Email** | `demo@pacific-rentclean.pf` |
| **Mot de passe** | `demo1234` |
| **Entreprise** | Pacific Rent&Clean (XPF, Pacific/Tahiti, préfixe PRC) |

Le compte contient 4 matériels (dont un en maintenance), 3 clients et 5 réservations couvrant tous les cas : terminée, en cours, **en retard**, confirmée à venir, à confirmer.

> ⚠️ **Quota Supabase** : si l'organisation Supabase a dépassé son quota gratuit d'egress mensuel (message `exceed_egress_quota`), l'API du projet est temporairement restreinte : l'application ne pourra pas se connecter tant que le quota n'est pas réinitialisé (début de cycle mensuel) ou le plan upgradé. Les données et migrations restent en place.

---

## Architecture

```
src/
├── app/
│   ├── (auth)/               # login, register, forgot/reset-password
│   ├── (onboarding)/         # configuration initiale de l'entreprise
│   ├── (app)/                # application (layout sidebar + topbar)
│   │   ├── dashboard/  bookings/  calendar/  equipment/
│   │   ├── customers/  assistant/  settings/
│   ├── api/assistant/chat/   # endpoint de l'assistant IA
│   └── auth/callback/        # échange de code PKCE (emails)
├── components/
│   ├── ui/                   # shadcn/ui
│   ├── layout/  shared/      # navigation, badges, états vides, confirmations
│   └── <module>/             # composants par module
├── lib/
│   ├── supabase/             # clients navigateur/serveur + proxy de session
│   ├── core/                 # métier PUR (prix, dates/fuseaux, statuts, labels FR)
│   ├── validations/          # schémas Zod partagés client/serveur
│   ├── ai/                   # provider, outils sécurisés, mode démo, propositions
│   └── auth/context.ts       # contexte utilisateur + organisation
├── server/actions/           # server actions (SEULE porte d'écriture)
└── proxy.ts                  # protection des routes (Next 16)
supabase/
├── migrations/               # schéma SQL versionné
└── seed.sql                  # données de démonstration
```

Décisions structurantes :

- **Multi-tenant par RLS** : chaque table métier porte `organization_id` ; les politiques PostgreSQL garantissent l'isolation même en cas de bug applicatif. Les écritures sensibles (organisations, compteurs) passent par des fonctions `SECURITY DEFINER` dédiées.
- **Anti double réservation au niveau base** : `create_booking()` / `update_booking_details()` prennent un verrou consultatif par matériel puis revérifient la disponibilité dans la même transaction.
- **Statuts dérivés, jamais stockés** : « en retard » = `in_progress` + retour dépassé ; « réservé / en location » du matériel = calculés depuis les réservations. Zéro risque de désynchronisation.
- **Les prix ne viennent jamais du navigateur** : les server actions relisent les tarifs en base avant tout calcul.
- **L'IA passe par des outils** : recherche, disponibilité, stats — toutes fonctions validées par Zod et scopées. Les actions sont des *propositions* confirmées par l'utilisateur, exécutées par les server actions standard.

---

## Sécurité

- Row Level Security sur **toutes** les tables (+ politiques de storage par organisation)
- Contrôles d'accès re-vérifiés dans chaque server action (`requireOrgContext`)
- Validation Zod côté client **et** côté serveur
- Aucune clé secrète exposée au navigateur (`NEXT_PUBLIC_*` = clé publique uniquement, protégée par RLS)
- Machine à états des réservations (transitions invalides refusées)
- Archivage logique (pas de suppression destructive de matériel/client avec historique)
- Journal d'activité (`activity_logs`) sur les actions importantes

---

## Tests

```bash
npm test
```

Couverture unitaire des fonctions critiques : calcul de prix et de durée, conversions de fuseau horaire (Tahiti + zones à heure d'été), machine à états des réservations, statut dérivé du matériel, schémas de validation (rejet des périodes invalides, des doublons de matériel…), préfixe de numérotation, interprétation des dates françaises du mode démo.

La détection de conflits et l'isolation multi-tenant sont garanties au niveau PostgreSQL (fonctions transactionnelles + RLS) ; les tests end-to-end Playwright des parcours complets sont prévus en V2 (voir Limites).

---

## Limites connues

1. **Quota egress Supabase** : l'organisation gratuite partagée avec d'autres projets peut atteindre son quota mensuel et restreindre temporairement l'API (voir encadré plus haut).
2. **Un seul rôle effectif** : le propriétaire. La table `organization_members` et les rôles (owner/admin/member) sont prêts, mais il n'y a pas encore d'invitation d'employés.
3. **Emails** : dépendent de la configuration SMTP Supabase (confirmation d'inscription, reset de mot de passe).
4. **Buckets publics en lecture** : les photos de matériel et logos sont servis en URL publique (écriture restreinte par organisation). Passer en buckets privés + URLs signées si des images sensibles sont stockées.
5. **Tarification V1 volontairement simple** : prix journalier × jours (toute journée entamée est due), remise et frais fixes. Pas de tarifs horaires/dégressifs/saisonniers.
6. **Assistant** : réponses non streamées (affichage d'un indicateur d'attente) ; le mode démo couvre les questions types listées dans l'interface.
7. **Pas de pagination serveur** sur les listes (adapté à un parc < ~500 éléments ; à ajouter au-delà).
8. **Tests e2e** non inclus dans ce lot (parcours critiques couverts par tests unitaires + garanties SQL).

---

## Feuille de route V2 (recommandée)

**Court terme (exploitation quotidienne)**
1. Contrat PDF généré à la confirmation + envoi email
2. Invitations d'employés (rôles admin/membre déjà modélisés)
3. Acomptes et paiements Stripe (architecture prête : montants/états déjà séparés)
4. Notifications (email/WhatsApp) de rappel de départ/retour et de retard
5. Pagination serveur + export CSV des listes

**Moyen terme (croissance)**
6. Tarifs avancés : demi-journée, hebdomadaire, dégressif, saisonnier, options/livraison
7. État des lieux photo au départ/retour
8. Multi-établissements et gestion fine des rôles
9. PWA installable (l'app est déjà responsive) puis application mobile
10. Tableau de bord analytique (taux d'occupation du parc, CA par catégorie)

**Long terme (produit)**
11. Portail de réservation public par entreprise (vitrine + demande en ligne)
12. Assistant IA proactif (alertes de retard, suggestions de relance, préparation de planning)
13. Marketplace multi-loueurs

---

*Projet généré et vérifié avec Claude Code — juillet 2026.*
