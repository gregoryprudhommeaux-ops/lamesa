# LA MESA — Cena Strategica Exclusiva

Plateforme pour dîners thématiques exclusifs à Guadalajara : landing, inscription profil, back-office organisateur, pages publiques de dîner.

## Stack

- **Next.js 16** + React 19 + TypeScript
- **NS Calque** (`@ns-suite/ui`) — design system Ultra Content Maker
- **next-intl** — FR (défaut) / EN / ES
- **Firebase Auth + Firestore** — membres, événements, participations, waitlist
- **Database Perso** — recherche contacts + upsert inscriptions (si endpoint configuré)
- **Brevo** — emails transactionnels
- **OpenAI / Perplexity / AI Gateway** — Table Builder + traduction templates

## Routes

| Route | Description |
|---|---|
| `/fr` | Landing — intro + CTA inscription |
| `/fr/light` | Inscription express (nom / email / WhatsApp) |
| `/fr/inscription` | Formulaire profil waitlist complet |
| `/fr/connexion` | Connexion membre (Google ou email+mot de passe) |
| `/fr/compte` | Espace membre |
| `/fr/e/{slug}` | Page publique dîner + RSVP |
| `/admin/login` | Connexion organisateur (Firebase — email allowlist) |
| `/admin/dashboard` | Cockpit ops |
| `/admin/evenements` | CRUD dîners + blancs |
| `/admin/templates` | Templates email + blast profils incomplets |

## Setup local

```bash
cp .env.example .env.local
# Remplir Firebase client + Admin, BREVO_*, RSVP_TOKEN_SECRET (obligatoire en prod)
# Pour Table Builder / traductions : OPENAI_API_KEY ou PERPLEXITY_API_KEY
# (AI Gateway : AI_GATEWAY_API_KEY + AI_GATEWAY_BASE_URL ensemble)
npm install
npm run dev
```

Ouvrir [http://127.0.0.1:3000/fr](http://127.0.0.1:3000/fr)

### Firebase Auth (local)

1. Console Firebase → Authentication → Sign-in method → activer **Google** + **Email/Password**.
2. Authentication → Settings → **Authorized domains** : ajouter `127.0.0.1` et `localhost`.
3. Les admins sont les emails dans `configuredAdminEmails()` (`gregory.prudhommeaux@gmail.com` + `NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS`).
4. Popup Google est préféré ; si bloqué, fallback redirect (nécessite le domaine autorisé).

### Scripts utiles

```bash
npm run lint
npm test
npm run build
```

## Variables d'environnement

Voir [.env.example](.env.example) (liste complète + commentaires).

**Client (NEXT_PUBLIC_*)** : Firebase web config, `NEXT_PUBLIC_APP_URL`, admin emails optionnels.  
**Server only** : `FIREBASE_*`, `BREVO_*`, `RSVP_TOKEN_SECRET`, `OPENAI_*` / `PERPLEXITY_*`, `DATABASE_PERSO_*`, `CRON_SECRET`, secrets FN.

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

Requiert `FN_FIREBASE_*` (voir `.env.example`). Endpoint runtime : `POST /api/admin/import/franconetwork` (header `x-franconetwork-import-secret`).

## Crons (Vercel)

| Path | Schedule (UTC) | Rôle |
|------|----------------|------|
| `/api/cron/event-reminders` | `0 15 * * *` | Survey satisfaction post-dîner |
| `/api/cron/profile-incomplete-nudge` | `0 15 1 * *` | Rappel ES si profil < 100 % (1er du mois) |

Auth : `Authorization: Bearer $CRON_SECRET` (ou `?secret=`). Désactiver un envoi = template off dans Admin → Templates.

## Database Perso upsert

L'endpoint `POST /api/public/contacts/upsert` est documenté dans [docs/database-perso-upsert.md](docs/database-perso-upsert.md). En attendant, les inscriptions sont stockées dans Firestore `la_mesa_waitlist`.

## Déploiement

Vercel — configurer les mêmes variables d'environnement + `NEXT_PUBLIC_APP_URL=https://lamesasecreta.com`.

Production : [https://lamesasecreta.com](https://lamesasecreta.com)
