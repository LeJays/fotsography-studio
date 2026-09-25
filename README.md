# Fotsography Studio — Système de gestion de studio photo

Application de gestion de studio (clients, projets, activités, paiements, tâches)
construite avec **React 19 + TypeScript + Vite + Tailwind CSS 4**, persistée dans
une base **PostgreSQL Neon** via **Prisma 7**.

## Démarrage

```bash
npm install          # dépendances (une seule fois)
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
| `npm run build` | Vérification TypeScript + build front dans `dist/` |
| `npm run db:push` | Synchronise `prisma/schema.prisma` avec la base Neon |

## Configuration

Le fichier `.env` (non versionné) doit contenir la chaîne de connexion Neon :

```
DATABASE_URL="postgresql://<user>:<password>@<host>/neondb?sslmode=require"
```

Variables optionnelles : `API_PORT` (défaut `3001`). Le port du proxy Vite suit
automatiquement `API_PORT`.

## Architecture

```
server/                 Backend Node (exécuté par `node`, TypeScript natif Node 24)
  index.ts              serveur HTTP : /api/health, /api/auth/register, /api/auth/login
  db.ts                 client Prisma 7 + driver adapter pg → Neon (JAMAIS importé par React)
  http.ts               lecture du corps JSON, réponses JSON, HttpError
  password.ts           hachage / vérification des mots de passe (scrypt, node:crypto)
  routes/auth.ts        validation (zod) + logique d'inscription et de connexion
scripts/dev.mjs         launcher de développement (API + Vite dans un seul terminal)
src/                    Front React
  lib/api.ts            appels fetch typés vers l'API
  context/AuthContext.tsx  session (localStorage) + login/register async
  pages/AuthPage.tsx    écran de connexion / création du compte admin (design 2 panneaux)
  assets/Logo Fotsography Studio_..._PICTO.jpg  pictogramme de la marque (écran de connexion)
public/logo-fotsography-studio.jpg  même picto, servi comme favicon (index.html)
prisma/schema.prisma    modèles de données (User, Client, Project, ...)
```

### Flux d'inscription (bout en bout)

1. `AuthPage` valide le formulaire puis appelle `registerAdmin()` (AuthContext).
2. `src/lib/api.ts` → `POST /api/auth/register` (même origine, relayé par le proxy Vite).
3. `server/routes/auth.ts` valide les données (zod), refuse un email déjà utilisé (409),
   hache le mot de passe (scrypt) puis écrit l'utilisateur dans Neon (`prisma.user.create`).
4. La réponse `{ user }` est enregistrée dans `localStorage` et ouvre la session.

La connexion (`POST /api/auth/login`) accepte indifféremment l'**adresse email** ou le
**nom complet** (`James Walter`), puis compare le mot de passe au hash scrypt stocké.

### Points de sécurité à reprendre plus tard

- Aucun compte admin existant n'est exigé : toute personne qui atteint le formulaire
  peut créer un compte `ADMIN` (limiter l'inscription publique/ajouter des invitations).
- L'étape « code de vérification » est purement locale : aucun email n'est envoyé.
- Les tâches restantes : expiration de session, renouvellement des identifiants,
  protection des routes `/api/*` (jeton JWT ou cookie signé).

## Base de données

`prisma/schema.prisma` décrit les tables. Après une modification du schéma :

```bash
npm run db:push        # crée / aligne les tables dans Neon
```

Projet initialisé depuis le template React + TypeScript + Vite.
