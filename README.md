# LA MESA — Cena Strategica Exclusiva

Plateforme pour dîners thématiques exclusifs à Guadalajara : landing, inscription profil, back-office organisateur, pages publiques de dîner.

## Stack

- **Next.js 16** + React 19 + TypeScript
- **NS Calque** (`@ns-suite/ui`) — design system Ultra Content Maker
- **next-intl** — FR (défaut) / EN / ES
- **Firebase Firestore** — événements, participations, waitlist
- **Database Perso** — recherche contacts + upsert inscriptions (si endpoint configuré)

## Routes

| Route | Description |
|---|---|
| `/fr` | Landing — intro + CTA inscription |
| `/fr/inscription` | Formulaire profil waitlist |
| `/fr/e/{slug}` | Page publique dîner + RSVP |
| `/admin/login` | Connexion organisateur |
| `/admin/evenements` | CRUD dîners + sélection contacts |

## Setup

```bash
cp .env.example .env.local
# Renseigner Firebase + ADMIN_PASSWORD + Database Perso
npm install
npm run dev
```

Ouvrir [http://127.0.0.1:3000/fr](http://127.0.0.1:3000/fr)

## Variables d'environnement

Voir [.env.example](.env.example).

- `ADMIN_PASSWORD` — accès back-office
- `DATABASE_PERSO_*` — API contacts (search + upsert)
- `FIREBASE_*` / `NEXT_PUBLIC_FIREBASE_*` — Firestore
- `FRANCONETWORK_IMPORT_SECRET` — sync silencieux FrancoNetwork → waitlist

## FrancoNetwork → waitlist

Les profils FN **validés / visibles annuaire** (`isValidated !== false`) sont importés dans `la_mesa_waitlist`. Au premier `/connexion` (même email), le profil est déjà pré-rempli.

**Nouveaux imports** (`created` / `revived`) : envoi auto du template système `fn_announcement` (ES). Les membres déjà actifs ne sont pas re-contactés. Désactiver le template dans Admin → Templates coupe l’auto-send.

**Cohorte existante** : filtre Inscrits → Source = FrancoNetwork, bouton « Envoyer l’annonce » sur la fiche (un par un).

```bash
# Dry-run (défaut)
npm run import:franconetwork

# Écriture
npm run import:franconetwork:apply
```

Requiert aussi `FN_FIREBASE_*` (voir `.env.example`). Endpoint runtime : `POST /api/admin/import/franconetwork` (header `x-franconetwork-import-secret`).

## Database Perso upsert

L'endpoint `POST /api/public/contacts/upsert` est documenté dans [docs/database-perso-upsert.md](docs/database-perso-upsert.md). En attendant, les inscriptions sont stockées dans Firestore `la_mesa_waitlist`.

## Déploiement

Vercel — configurer les mêmes variables d'environnement + `NEXT_PUBLIC_APP_URL=https://lamesasecreta.com`.

Production : [https://lamesasecreta.com](https://lamesasecreta.com)
