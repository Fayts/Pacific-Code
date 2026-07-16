# Pacific Rent&Clean — Maquette interactive

Maquette cliquable de la future web app **Pacific Rent&Clean** (location de
matériel de nettoyage & prestations à domicile à Tahiti), destinée à remplacer
à terme le site vitrine et Shopify.

> ⚠️ **Démonstration uniquement** : aucune base de données, aucun paiement
> réel, aucune authentification. Toutes les données sont fictives et vivent
> dans `src/lib/data.ts` ; les réservations simulées sont stockées dans le
> `localStorage` du navigateur.

## Lancer la maquette

```bash
npm install
npm run dev
```

Puis ouvrir <http://localhost:3000>.

## Contenu

**Partie client** — accueil `/`, catalogue locations `/locations`, catalogue
prestations `/prestations`, fiche produit `/produit/[slug]`, parcours de
réservation en 5 étapes `/reservation`, confirmation `/confirmation`, espace
client fictif `/compte`.

**Partie administrateur** (`/admin`) — tableau de bord, calendrier,
réservations (liste + fiche), clients, produits, prestations, paiements,
livraisons, paramètres.

## Repères métier

- Devise : **XPF** · Fuseau : **Pacific/Tahiti**
- Livraison incluse entre **Papenoo et Papeete**, supplément **1 500 XPF** au-delà
- Exemples : Kärcher Puzzi 10/1, Pack Auto-Home, nettoyage de canapé, nettoyage de matelas

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · lucide-react.
Composants UI maison inspirés de shadcn/ui (`src/components/ui.tsx`).

## À connecter plus tard (Supabase)

- Tables produits/prestations, clients, réservations, paiements, livraisons
- Authentification (espace client + rôles admin)
- Calcul serveur des disponibilités et des frais de livraison
- Paiement en ligne réel et notifications (e-mail/SMS)
