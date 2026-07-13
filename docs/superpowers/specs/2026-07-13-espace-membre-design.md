# Espace membre LA MESA — Design Spec

> Validé via questionnaire (`espace-membre-questionnaire.canvas.tsx`), 13 juil. 2026.

## Objectif

Transformer `/compte` (page monolithique profil + invitations) en espace membre v1 complet : onglets Dashboard / Calendrier / Mon profil, page Réglages, parrainage, soft-delete, et alerte email admin à chaque inscription.

## Navigation & layout

| Décision | Choix |
|---|---|
| Onglets | Haut à droite du bloc blanc (style onglets) |
| Label + ordre | Dashboard · Calendrier · Mon profil (libellé calendrier = « Calendrier ») |
| Routing onglets | Query string : `/{locale}/compte?tab=dashboard\|calendrier\|profil` (défaut `dashboard`) |
| Largeur contenu | Centré, `max-w-2xl` (inchangé) |
| Réglages | Page dédiée `/{locale}/reglages` |
| Accès Réglages | Lien visible si logged-in **et** hors pages `/admin/*` |

## Calendrier membre

- Affiche **tous les dîners `published`**.
- **Highlight** des événements où le membre a une participation (`event_participations` pour son email).
- **Clic** : uniquement si invité (participation existante). Sinon l’événement est visible mais non cliquable.
- Détail événement (si invité) : infos event + liste des autres convives **uniquement** `status === "present"`.

## Mon profil

- Lecture / édition des champs d’inscription du **propre** profil waitlist uniquement.
- **Aucun** accès aux profils des autres membres (hors admin existant `/admin/inscrits`).
- Lien vers Réglages en bas de Mon profil.

## Dashboard

Compteurs :

1. Nb d’invitations reçues (tous statuts)
2. Nb de participations (événements **passés** avec status `present` **ou** `invited`)
3. Nb d’invitations à venir (`startsAt >= now`)
4. Nb d’amis parrainés (filleuls ayant accepté)

Invitation d’un ami : **lien de parrainage + option email**.

## Parrainage

- Statut parrain : attribué quand un user est invité via le code d’un autre **et accepte** (inscription via `?ref=CODE` validée).
- **L’admin ne peut pas être parrain** (pas de code, pas d’attribution).
- Code : dérivé du prénom, ex. `GREG-7K` (préfixe lettres du prénom + suffixe aléatoire).
- Génération : au **premier** clic « Inviter un ami » (lazy).
- Code / lien : **définitifs** (pas de régénération).
- Visibilité : membre = ses filleuls ; admin = colonne / filtre sur `/admin/inscrits`.

## Réglages (`/reglages`)

Contenu :

- Email + nom affichés
- Lien vers Mon profil (`/compte?tab=profil`)
- Déconnexion
- Soft-delete profil waitlist (masqué, données conservées pour admin)
- Suppression aussi du compte Firebase Auth (après soft-delete profil)

## Soft-delete

- Champ `deletedAt?: string` (ISO) sur `la_mesa_waitlist`.
- Les lectures membre / inscription / `/api/me` ignorent les profils soft-deleted.
- L’admin voit toujours les inscrits soft-deleted (filtre / badge).
- Les `event_participations` **ne sont plus hard-deleted** à la suppression membre (conservées pour historique admin).

## Email admin (note libre)

À chaque nouvelle inscription réussie (`POST /api/register`), envoyer un email à tous les emails admin (`configuredAdminEmails()`) avec les infos du profil inscrit. Non-bloquant (comme la confirmation membre).

## Hors scope v1

- Notifications push, chat, paiement, pages profil public, régénération de code parrain.

## Stack existante à réutiliser

- Next.js 16 App Router, next-intl (`es` défaut, `en`, `fr`)
- Firebase Auth (Google) + Firestore Admin SDK
- Collection profils = `la_mesa_waitlist` (pas de collection users séparée)
- Participations = `event_participations` (`invited` \| `present` \| `declined` \| `waitlist`)
- Emails = Resend HTTP (`src/lib/email/`)
- Shell carte blanche : `LaMesaShell` `card` `max-w-2xl`
- Pattern nav admin : `AdminShell` (référence visuelle / structure, pas de reuse hard)
