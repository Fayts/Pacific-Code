# Pacific Code

Assistant de gestion pour les entreprises de location — matériel, véhicules, nautique, événementiel. MVP construit pour le client pilote **Pacific Rent&Clean** (location de matériel de nettoyage, Polynésie française).

Pacific Code remplace les outils dispersés (Google Calendar, Excel, WhatsApp, contrats Word, notes papier) par une seule application : catalogue, clients, réservations, disponibilités, calendrier, tableau de bord et assistant IA.

> **Version de démonstration** : cette version fonctionne **sans aucune base de données**. Toutes les données sont fictives et vivent dans le navigateur (localStorage) — chaque visiteur dispose de son propre bac à sable. Objectif : valider l'expérience utilisateur avant de brancher le backend (voir [Architecture](#architecture)).

---

## Sommaire

- [Démarrage rapide](#démarrage-rapide)
- [Le mode démonstration](#le-mode-démonstration)
- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Commandes](#commandes)
- [Tests](#tests)
- [Déploiement (Vercel)](#déploiement-vercel)
- [Étapes suivantes](#étapes-suivantes)

---

## Démarrage rapide

Prérequis : Node.js ≥ 20.9. **Aucune variable d'environnement, aucun service externe.**

```bash
git clone https://github.com/Fayts/Pacific-Code.git pacific-code
cd pacific-code
npm install
npm run dev        # → http://localhost:3000
```

Sur la page de connexion, **entrez n'importe quel email et mot de passe** : vous arrivez sur un espace pré-rempli de données fictives (Pacific Rent&Clean). L'inscription fonctionne aussi et personnalise le nom de l'entreprise.

## Le mode démonstration

- **Authentification simulée** : tout email/mot de passe est accepté ; la session vit dans le navigateur.
- **Données fictives** : 4 matériels (dont un en maintenance), 3 clients, 5 réservations couvrant tous les cas — terminée, en cours, **en retard**, confirmée à venir, à confirmer. Les notes portent la mention « (Données fictives) ».
- **Persistance locale** : vos ajouts/modifications sont conservés dans le navigateur (localStorage), pas de synchronisation entre appareils.
- **Réinitialisation** : Paramètres → « Réinitialiser les données de démo » restaure le jeu d'origine sans vous déconnecter.
- **Non disponible en mode démo** (nécessite le backend) : photos de matériel, logo, envoi d'emails, multi-appareils.

## Fonctionnalités

| Module | Contenu |
|---|---|
| **Tableau de bord** | Départs/retours du jour, locations en cours, retards, CA estimé du mois, résumé du parc, prochaines opérations, actions rapides |
| **Matériel** | Catalogue avec catégories, prix journalier, caution, quantités multiples, durée minimale, statuts dérivés (dispo/réservé/en location/maintenance/indisponible/archivé), recherche insensible aux accents, filtres, fiche avec historique et CA généré, duplication, maintenance, archivage avec garde-fou |
| **Clients** | Particuliers et professionnels, recherche multi-champs, statistiques par client, fiche avec historique et total dépensé, archivage avec garde-fou |
| **Réservations** | Numérotation automatique (PRC-2026-0001), création guidée (client → matériels → dates → disponibilité → prix), **vérification de disponibilité en direct avec conflits détaillés**, calcul automatique durée/prix, remise et frais, caution suggérée, machine à états (brouillon → à confirmer → confirmée → en cours → terminée / annulée / **en retard** dérivé), paiement et caution, chronologie, duplication, brouillon toléré malgré un conflit |
| **Calendrier** | Vues mois et semaine dans le fuseau de l'entreprise, couleurs par statut, filtres matériel/statut, détection visuelle des conflits de quantité |
| **Assistant IA** | Simulé, 100 % côté client : disponibilités, retards, statistiques, locations par période… et **préparation de réservation en langage naturel** (« Crée une réservation pour Jean demain avec la Puzzi 10/1 ») avec carte de confirmation — rien n'est créé sans validation explicite |
| **Paramètres** | Informations entreprise, devise, fuseau, format de date, préfixe de numérotation, réinitialisation des données de démo |

## Stack technique

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript strict**
- **Tailwind CSS v4** + **shadcn/ui** (Base UI)
- **react-hook-form** + **Zod 4** (validation)
- Helpers de fuseau horaire maison (Intl) — Pacific/Tahiti par défaut
- **Vitest** — 124 tests unitaires
- Aucune dépendance d'exécution à un backend

## Architecture

Le principe structurant du MVP : **l'interface ne sait pas d'où viennent les données.**

```
UI (composants React)
  → Services (règles métier : validation zod, prix, disponibilité, machine à états)
    → Repository (contrat d'accès aux données : interfaces TypeScript)
      → Adapter MOCK (localStorage)   ← aujourd'hui
      → Adapter Supabase              ← demain, sans toucher UI ni services
```

```
src/
├── app/
│   ├── (auth)/                # connexion / inscription simulées
│   ├── (app)/                 # dashboard, equipment, customers, bookings,
│   │                          # calendar, assistant, settings
│   └── …                      # pages serveur = enveloppes (métadonnées)
├── components/<module>/       # composants par module (dont *-client.tsx)
├── lib/
│   ├── data/
│   │   ├── repositories.ts    # LE contrat : interfaces des repositories
│   │   └── mock/              # adapter localStorage + jeu de données fictives
│   ├── services/              # booking, equipment, customer, organization
│   ├── core/                  # métier PUR : prix, dates/fuseaux, statuts, labels FR
│   ├── validations/           # schémas Zod
│   └── ai/                    # moteur d'assistant simulé + toolkit mock
└── proxy.ts                   # passe-plat (la garde de session est côté client)
supabase/migrations/           # schéma SQL versionné — appliqué NULLE PART pour l'instant
```

Décisions structurantes :

- **Statuts dérivés, jamais stockés** : « en retard » = en cours + retour dépassé ; « réservé / en location » du matériel = calculés depuis les réservations.
- **Les prix ne viennent jamais du formulaire** : les services relisent les tarifs du catalogue avant tout calcul.
- **L'assistant passe par des outils** : un contrat d'exécuteurs interchangeables (mock aujourd'hui, LLM + vraie base demain) ; ses actions sont des *propositions* confirmées par l'utilisateur puis exécutées par les services standard.
- **La version Supabase complète** (multi-tenant RLS, anti double-réservation transactionnelle, stockage de photos, assistant LLM) est préservée sur la branche [`archive/supabase-v1`](https://github.com/Fayts/Pacific-Code/tree/archive/supabase-v1) et servira de référence pour l'adapter réel.

## Commandes

```bash
npm run dev         # serveur de développement (http://localhost:3000)
npm run build       # build de production
npm run start       # servir le build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # tests unitaires (vitest)
```

## Tests

124 tests unitaires couvrent les fonctions critiques : calcul de prix et de durée, conversions de fuseau horaire (Tahiti + zones à heure d'été), machine à états, statuts dérivés, schémas de validation, numérotation, interprétation des dates françaises de l'assistant, provider mock (conflits, quantités, archivage, persistance) et services (équipement, clients).

## Déploiement (Vercel)

L'application se déploie telle quelle, **sans aucune variable d'environnement** :

1. Sur [vercel.com](https://vercel.com), « Add New → Project » et importez le dépôt GitHub `Fayts/Pacific-Code`.
2. Framework détecté automatiquement (Next.js) — ne rien changer, ni build command ni env vars.
3. Deploy. Chaque `git push` sur `main` redéploie automatiquement.

Chaque visiteur de l'URL obtient son propre bac à sable de données dans son navigateur.

## Étapes suivantes

1. **Validation UX** sur la démo en ligne (objectif de cette version).
2. **Connexion Supabase Cloud** : implémenter l'adapter `supabase` derrière les interfaces de `src/lib/data/repositories.ts` (activation par `NEXT_PUBLIC_DATA_MODE=supabase`), appliquer les migrations du dépôt, rebrancher l'authentification réelle — sans toucher à l'UI ni aux services.
3. **Assistant LLM** (Claude / OpenAI / Gemini) via le même contrat d'outils que le mode simulé.
4. Puis la feuille de route produit : contrats PDF, paiements, invitations d'employés, notifications…

---

*Projet développé et vérifié avec Claude Code — juillet 2026.*
