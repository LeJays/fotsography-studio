# Fotsography Studio — Système de gestion de studio photo

Application de gestion de studio (clients, projets, activités, tâches, rémunérations,
pénalités de retard) construite avec **React 19 + TypeScript + Vite + Tailwind CSS 4**,
persistée dans une base **PostgreSQL Neon** via **Prisma 7**.

## Démarrage

```bash
npm install          # dépendances (une seule fois) + génération du client Prisma
npm run dev          # lance l'API (port 3001) + Vite (port 5173)
```

Ouvrir <http://localhost:5173>. `Ctrl + C` arrête les deux processus.

Autres scripts :

| Commande | Rôle |
| --- | --- |
| `npm run dev` | API + front ensemble (recommandé) |
| `npm run dev:web` | Vite uniquement (l'API doit tourner à côté) |
| `npm run dev:api` | API uniquement, avec rechargement automatique |
| `npm run start:api` | API uniquement, sans watch (production) |
| `npm run typecheck` | `prisma generate` + vérification TypeScript (front + serveur) |
| `npm run build` | Typecheck + build du front dans `dist/` |
| `npm run lint` | Analyse statique (oxlint) |
| `npm run test:smoke` | Tests de fumée de l'API (authentification, rôles, équipe) |
| `npm run test:penalty` | Tests de calcul des pénalités de retard (sans base de données) |
| `npm run test:penalty:e2e` | Scénario complet des pénalités sur l'API réelle (API à lancer) |
| `npm run db:push` | Synchronise `prisma/schema.prisma` avec la base Neon |

## Configuration

Copier `.env.example` en `.env` (non versionné) et renseigner la chaîne Neon :

```
DATABASE_URL="postgresql://<user>:<password>@<host>/neondb?sslmode=require"
JWT_SECRET="<secret aléatoire>"          # signature des cookies de session
```

Variables optionnelles : `API_PORT` (défaut `3001`), `PORT` (prioritaire, injecté par les
hébergeurs cloud), `COOKIE_SECURE=true` (cookie de session réservé à HTTPS),
`ALLOW_PUBLIC_ADMIN_SIGNUP=true` (ré-autorise la création publique d'un compte admin),
`API_URL` (cible des scripts de test). Le port du proxy Vite suit automatiquement `API_PORT`.

## Fonctionnalités

- **Clients & projets** : fiches clients, projets/événements, date d'événement, livraison
  globale, montants et plan de paiement (avance / intermédiaire / solde), encaissements
  avec reçu.
- **Activités & tâches** : une activité regroupe les tâches d'un projet ; chaque tâche est
  assignée à un membre, avec instructions détaillées, date de livraison calculée à J‑5 de la
  livraison globale (modifiable) et preuve (lien photo/vidéo) obligatoire pour terminer.
- **Cycle de vie d'une tâche** : `À faire → En vérification → Terminée` ; l'admin valide ou
  renvoie avec motif et corrections demandées (la tâche repart en « À faire »).
- **Rémunérations** : rémunération par tâche, versements totaux ou par tranches (espèces /
  Mobile Money / virement), historique des versements et reçu PDF.
- **Pénalités de retard** : cumul automatique, déduction sur les versements, encaissement
  partiel et traçabilité (section dédiée ci-dessous).
- **Finances** : recettes, dépenses, rémunérations, marge nette, bilan par projet, export CSV.
- **Équipe** : création des membres, rôle, désactivation, réinitialisation de mot de passe.
- **Réglages du studio** : identité (nom, NIU/RCCM…), plan de paiement par défaut, délai de
  livraison des tâches, préfixe des reçus, activation des pénalités.

## Rôles et permissions

| Rôle | Accès |
| --- | --- |
| `ADMIN` | Tout : clients, projets, activités, dépenses, finances, équipe, réglages, pénalités, versements, validation des tâches |
| `ASSISTANT` | Pilotage opérationnel : projets, activités, distribution et suivi des tâches, **consultation et encaissement des pénalités**. Ni les finances globales, ni les versements |
| `PHOTOGRAPHER`, `VIDEOGRAPHER`, `EDITOR` | « Mes tâches » et le détail de leurs tâches : avancement, preuve, rémunération et pénalités personnelles |
| `CLIENT` | Non concerné (application interne) |

Les gardes sont appliquées **côté serveur** (`requireAuth`, `requireRole` dans
`server/middleware/auth.ts`) et **côté front** (`RequireRole` dans `src/app/router.tsx`,
liens du menu dans `src/app/navigation.ts`) : les deux doivent rester alignés.

## Pénalités de retard

Module **activable / désactivable** depuis les **Réglages du studio** (une case à cocher),
avec un montant de tranche et un intervalle réglables (10 000 F tous les 2 jours par défaut).
Aucune sanction n'est calculée tant que l'option est décochée ; les dettes déjà acquises
restent dues.

### Règles de calcul

- Une tâche dont la date de livraison est passée **et dont le travail n'a pas été envoyé**
  (statut encore « À faire ») cumule une sanction **dès 1 jour de retard**, puis une tranche
  tous les N jours : `ceil(jours de retard / N) × montant`.
- Le cumul **se fige** dès que le membre envoie son travail (« En vérification » ou
  « Terminée ») ou à l'archivage de la tâche ; les tranches déjà acquises restent dues.
- Un cumul acquis **ne redescend jamais** : une date de livraison repoussée après coup ne
  gomme pas la pénalité déjà comptée, et un changement de montant ne s'applique qu'aux
  nouvelles tranches.
- Une tâche assignée à l'**admin** n'est jamais pénalisée (aucune rémunération membre n'y est
  prévue).

### Solde, déduction et encaissement

- **Solde dû** d'un membre = Σ cumuls de ses tâches − Σ règlements enregistrés.
- **Déduction automatique** : à chaque versement de rémunération, le solde dû est retenu sur
  le montant versé (`min(solde, versement)`), un règlement de type `WITHDRAWN` est créé et le
  reçu indique brut / pénalité déduite / net versé.
- **Sans versement en cours** : la dette reste enregistrée et sera déduite du prochain
  versement du membre.
- **Encaissement partiel** : l'admin **et l'assistant** enregistrent un paiement direct
  (montant libre, moyen, référence, note) ; le solde se met à jour immédiatement. Un montant
  supérieur au solde dû est refusé (400), un solde nul l'est aussi (409).

### Traçabilité

Chaque règlement — paiement direct ou déduction — est enregistré dans `PenaltyPayment` avec le
membre, le montant, le type, le moyen, la référence, la tâche et le reçu concernés, la date et
**l'utilisateur qui l'a encaissé** ; un audit log est également écrit (`penalty.payment`). La
page **Pénalités** (`/penalites`) affiche les soldes par membre, les tâches pénalisées et
l'historique complet.

### Où se trouve le code

- Calcul et synchronisation : `server/services/penalties.ts` (`describePenalty`,
  `syncTaskPenalty`, `memberPenaltyBalance`) — le cumul est resynchronisé à chaque
  lecture/écriture de tâche, il est donc toujours à jour.
- API : `server/routes/penalties.ts` (`GET /api/penalties`,
  `POST /api/penalties/payments` — rôles `ADMIN` et `ASSISTANT`).
- Déduction sur versement : `server/routes/tasks.ts` (`payTaskPayout`).
- Interface : `src/features/finances/PenaltiesPage.tsx` + `PenaltiesPanel.tsx`, carte de
  réglage dans `src/features/settings/SettingsPage.tsx`.

## API

Toutes les routes sont préfixées par `/api` et renvoient du JSON. La session voyage dans un
cookie httpOnly signé (`fotsography_session`, 7 jours) ; le front utilise
`credentials: 'include'`.

| Domaine | Routes |
| --- | --- |
| Santé | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/setup-status`, `POST /auth/password` |
| Équipe | `GET /users`, `GET /users/assignable`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id`, `POST /users/:id/reset-password` |
| Clients | `GET /clients`, `GET /clients/:id`, `POST /clients`, `PATCH /clients/:id`, `DELETE /clients/:id` |
| Projets | `GET /projects`, `GET /projects/:id`, `POST /projects`, `POST /projects/:projectId/payments` |
| Activités | `GET /activities`, `POST /activities`, `PATCH /activities/:id`, `DELETE /activities/:id` |
| Tâches | `GET /tasks` (`?activityId=`, `?mine=true`), `GET /tasks/:id`, `POST /tasks`, `PATCH /tasks/:id`, `PATCH /tasks/:id/progress`, `POST /tasks/:id/payout`, `POST /tasks/:id/review`, `DELETE /tasks/:id` |
| Dépenses | `GET /expenses` (`?activityId=`), `POST /expenses`, `PATCH /expenses/:id`, `DELETE /expenses/:id` |
| Finances | `GET /finances` (admin) |
| Pilotage | `GET /operations/overview` (admin + assistant) |
| Pénalités | `GET /penalties`, `POST /penalties/payments` (admin + assistant) |
| Réglages | `GET /settings`, `PATCH /settings` (admin) |

## Architecture

```
prisma/schema.prisma    modèles (User, Client, Project, Activity, Task, TaskPayout,
                        TaskReview, PenaltyPayment, StudioSettings, Receipt, AuditLog…)
server/                 Backend Node (TypeScript natif, exécuté par `node`)
  index.ts              serveur HTTP, montage des routes, service de dist/ en production
  router.ts             routeur maison (chemins, middlewares, 404 / 405)
  db.ts                 client Prisma 7 + adapter pg → Neon (JAMAIS importé par React)
  http.ts               corps JSON, réponses JSON, HttpError, cookies
  password.ts           hachage / vérification des mots de passe (scrypt)
  serialize.ts          sérialiseurs partagés
  middleware/auth.ts    session signée + requireAuth / requireRole
  middleware/validate.ts  validation zod du corps et des query params
  routes/               un fichier par domaine (auth, users, clients, projects, activities,
                        tasks, expenses, payments, finances, operations, penalties, settings)
  services/audit.ts     journal d'audit (opérations sensibles)
  services/penalties.ts calcul et synchronisation des pénalités de retard
shared/                 code partagé front + back (types, schémas zod, dates, monnaie)
scripts/dev.mjs         lanceur de développement (API + Vite dans un seul terminal)
scripts/smoke.ts        tests de fumée de l'API
scripts/penalty-*.ts    tests du module pénalités (calcul + bout en bout)
src/                    Front React
  app/                  routes, gardes, navigation, layout
  components/ui/        primitives (Card, Table, Modal, Badge, Toast…)
  features/             une page par domaine (clients, projets, tasks, finances, équipe…)
  lib/api.ts            client HTTP typé
  lib/receiptPdf.tsx    génération des reçus PDF (react-pdf)
```
## Base de données

Après une modification du schéma :

```bash
npm run db:push        # crée / aligne les tables dans Neon
```

Le projet utilise `prisma db push` (pas de migrations versionnées). Le client Prisma est
régénéré automatiquement (`postinstall`, `typecheck`, `build`) : après un `npm install`,
aucune erreur de type « property does not exist on PrismaClient » ne doit apparaître — sinon
lancer `npx prisma generate` puis recharger la fenêtre de l'éditeur.

## Tests

```bash
npm run typecheck        # TypeScript front + serveur
npm run lint             # oxlint
npm run test:penalty     # 13 vérifications du calcul des pénalités (hors base)
npm run test:smoke       # authentification, rôles, équipe (API à lancer au préalable)
npm run test:penalty:e2e # scénario complet pénalités (API à lancer ; nettoie ses données)
```

Les tests E2E créent un client, un projet, une activité et une tâche éphémères, les
suppriment à la fin et **restaurent les réglages d'origine** : ils peuvent être rejoués sur la
base de développement sans risque pour les données réelles.

## Flux d'inscription (bout en bout)

1. `AuthPage` appelle `GET /api/auth/setup-status` : le formulaire d'inscription n'apparaît
   que si aucun administrateur n'existe (ou si `ALLOW_PUBLIC_ADMIN_SIGNUP=true`).
2. `src/lib/api.ts` → `POST /api/auth/register` (même origine, relayé par le proxy Vite).
3. `server/routes/auth.ts` valide les données (zod), refuse un email déjà utilisé (409),
   hache le mot de passe (scrypt) puis écrit l'utilisateur dans Neon.
4. La réponse pose un cookie de session httpOnly signé (`JWT_SECRET`) et ouvre l'application.

La connexion (`POST /api/auth/login`) accepte indifféremment l'**adresse email** ou le
**nom complet** (`Adriel Fotso`), puis compare le mot de passe au hash scrypt stocké. Une
session dure 7 jours ; le renouvellement se fait par `POST /api/auth/password` (mot de passe
actuel obligatoire) ou par réinitialisation côté admin.

## Déploiement

`render.yaml` décrit un service Node unique : le serveur sert l'API `/api/*` **et** le front
compilé (`dist/`). Variables à définir : `DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECURE=true`.
`npm run build` produit le front, `npm run start:api` démarre le tout, la sonde de santé est
`/api/health`.

## Points de sécurité à reprendre plus tard

- La création d'un compte admin est bloquée dès qu'un administrateur existe ; l'ouverture
  publique reste possible via `ALLOW_PUBLIC_ADMIN_SIGNUP=true` (à ne pas activer en
  production).
- L'étape « code de vérification » est purement locale : aucun email n'est envoyé.
- Les tâches restantes : renouvellement automatique des identifiants, limitation de débit
  sur la connexion, journal d'audit consultable depuis l'interface.

  ## Prochaines modifications
  Tu vois je voudrais si possible les notifications du genre quand on attribue une tâche à une personne il reçoit une notification sur son téléphone, de même chez l'admin tu comprends et tu peux me proposer tous les cas pour les notification dans le projet sans code propose d'abord