# Project memory — LA MESA

Living product memory maintained with **Jack**.  
Update after material UX/product decisions. Prefer facts over aspirations.  
Distinguish **observed** facts from **hypotheses**.

## Vision & value proposition

Plateforme d’ops + expérience membre pour dîners thématiques exclusifs (Guadalajara / multi-ville) : landing, inscription, espace membre, back-office organisateur, RSVP / paiement / satisfaction.

## Users, roles, needs

| Rôle | Besoins principaux |
|------|-------------------|
| Organisateur (admin) | Piloter un dîner par phase, relancer, composer tables, envoyer communications |
| Membre | S’inscrire, RSVP, payer, compléter profil, feedback |
| Prospect / inscrit express | Entrée légère → conversion profil / Google |

## Critical journeys & steps

| ID | Type | Nom | Étapes (résumé) | Next best action typique |
|----|------|-----|-----------------|---------------------------|
| J1 | Opérationnel | Ops dîner (admin) | Prépa → Audience → STD → Qualif → Invite → Confirm/pay → Prépa dîner → Check-in → Feedback | Relancer paiements / finaliser table |
| J2 | Consommateur | Membre RSVP → présence | Découvrir → intérêt → confirmer → payer → vivre → feedback | Compléter action manquante (profil / paiement) |
| J3 | Commercial | Outreach / STD / invite | Segmenter → envoyer → qualifier réponses | Envoyer vague ciblée |
| J4 | Consommateur | Express → profil | Light signup → connexion → compléter fiche | Compléter profil / Google login |

### Event phases (command center)

Canonical ids (`OpsPhaseId`) — interest mode shows all 9; RSVP skips `save_the_date` + `qualify`.

1. `prep` — Préparation  
2. `audience` — Audience  
3. `save_the_date` — Save the Date (interest)  
4. `qualify` — Qualification (interest)  
5. `formal` — Invitation formelle  
6. `payment` — Confirmation & paiement  
7. `dinner_prep` — Préparation du dîner (places)  
8. `checkin` — Check-in  
9. `feedback` — Feedback  

URL `?phase=` accepts these ids; legacy (`std`, `definitive`, `std_email`, `std_relance`, `auto`) normalize via `normalizeOpsPhaseId`.

## Business objects & lifecycle

Événement · Contact/waitlist · Prospect · Participation · Paiement · Communication/template · Waitlist/places · Feedback/satisfaction · Tâche ops (implicite).

## UX/UI principles (project-specific)

- **Dashboard = porte d’entrée** du backend (Maintenant · À traiter · Accès)
- **Maintenant = moment T** : un seul focus (résultats dernier email / bilan post-dîner CA+satisfaction / prochain dîner) — pas deux colonnes concurrentes ni blocs blancs vides
- Nav admin courte : Dashboard · Dîners · Personnes · Tables · Coms
- Chrome admin homogène (pas de nav site public dans l’ops)
- Coms = envoyer / suivre ; créer un template est secondaire
- Centre de commande par phase (pas fiche événement infinie)
- Next best action + blocages visibles
- Roster participants unifié + filtres
- Templates email en drawer (CTA Envoyer reste primaire)
- FR / EN / ES
- Mémoire contact : ne pas mélanger déclaré / observé / inféré

## Admin IA (porte + hubs)

| Item | Route | Notes |
|------|-------|-------|
| Dashboard | `/admin/dashboard` | Porte — Maintenant = moment T (`resolveDashboardMoment`) |
| Dîners | `/admin/evenements` | Pilotage + `?view=calendrier` |
| Personnes | `/admin/personnes` | Onglets Membres / Prospects / Mémoire |
| Tables | `/admin/tables` | Top-level (validé) |
| Coms | `/admin/templates` | Templates + envois |

Legacy redirects : `/admin/inscrits`, `/admin/prospects`, `/admin/contacts`, `/admin/calendrier`.

## Validated decisions

| Date | Décision | Raison |
|------|----------|--------|
| 2026-09-25 | Agent Jack v2 + `PROJECT_MEMORY.md` | Capitaliser parcours + mémoire relationnelle |
| 2026-09-25 | Command center événement tranches 1–2 | Étape active + roster + drawers |
| 2026-09-25 | 9 phases produit (`OpsPhaseId`) + suggestOpsPhase | Labels métier + Formal/Places/paiement séparés |
| 2026-09-26 | Admin IA : Dashboard porte + 5 nav ; Personnes 1 écran onglets ; Tables top-level | Moins de menus plats, une entrée unique |
| 2026-09-26 | Continuité admin : files queue= + NBA Dashboard + Tables?eventId= | Promesses « À traiter » tenues ; contexte dîner portable |
| 2026-09-26 | Chrome admin unique (workspace) + Coms = envoi d’abord | Fin du whiplash ; intention hub claire |
| 2026-09-26 | Dashboard moment T (post-event / email pulse / next dinner) | Une info prioritaire selon l’étape du process ; CA + satisfaction après dîner |

## Reusable components / patterns

- `ops-phases` + `suggestOpsPhase` + `EventCommandHeader` / `EventCommandPhaseNav`
- `AdminEventParticipantRoster` + `EventTemplateDrawer`
- `FormalInviteOuiPanel` (phase formal) · `AdminEventPlacesAvailablePanel` (phase dinner_prep)
- `AdminPersonnesWorkspace` · `AdminDinersViewToggle`
- Admin shell, RequireAuth, table builder, contact fiche

## Data, signals & governance

| Couche | Sources actuelles | Gaps |
|--------|-------------------|------|
| Base | Waitlist / prospects | |
| Historique | Activities, RSVP, emails, satisfaction | |
| Enrichie | Completion %, engagement heuristics | Inférences souvent non étiquetées |
| Gouvernance | Source tags, timestamps | Consentement / fiabilité peu visibles UI |

**Epistemic rule:** déclaré · observé · calculé · inféré (+ confiance + source).

## Known UX/product debt

| Item | Status |
|------|--------|
| Monolithe `admin-events.tsx` | En cours — 9 phases branchées |
| FormalInviteOui encore panel dédié (pas fusion roster) | Ouvert — dans phase formal |
| Check-in UI dédiée | Placeholder roster payés |
| Chrome Personnes vs reste (whiplash) | Done — workspace partout |
| Coms ouvre sur « créer template » | Done — envoi d’abord |
| Page publique `/e` bifurquée | Ouvert — vague 2 |

## Email funnel — audit 2026-09-26

Séquence voulue (mode intérêt) : **STD → Relance STD → Invitation → Relance paiement → Confirmation paiement → Rappels présence → Survey**.

Faits code (pas de logs d’envoi prod consultés) :

| Moment | Clé | Déclencheur réel | Verdict |
|--------|-----|------------------|---------|
| STD | `save_the_date` | Manuel, phase événement | Garder |
| Accusé réponse | `interest_ack` | Auto après formulaire intérêt | Garder, hors étape campagne |
| Relance STD | `std_relance` | Manuel depuis Qualification, une fois, playlist « SANS RÉPONSE » | P1 fait |
| Invitation | `calendar_invite` | Manuel ; corps déjà = prix + IBAN + ICS | Garder |
| Relance paiement | `payment_relance` | Manuel, phase paiement, une fois (`paymentRelanceSentAt`) | P0 fait : plus d’envoi au clic OUI ; second blast ignoré |
| Confirmation | `participation_confirmed` | Auto quand statut → `confirmed` | Garder |
| Rappels J-7 / H-36 / H-1h30 | ICS VALARM dans l’invitation | Calendrier natif | C’est le vrai mécanisme |
| Rappels email | `reminder_*` | Archivés, hors bibliothèque | P1 fait — seul le calendrier rappelle |
| Survey | `satisfaction_survey` | Cron / manuel, places payées (`confirmed`, y compris `present`) | P1 fait — plus d’envoi aux OUI non payés |
| Dernier appel | `places_available` | Manuel | Exception, pas une étape du funnel |
| Hors dîner | `light_signup`, `profile_incomplete` (cron 1er du mois), `fn_announcement`, `referral_invite` | Divers | Garder dans une bibliothèque séparée |

Les 9 phases placent STD, qualification, invitation, paiement, places et feedback au bon endroit. Coms sépare **Funnel dîner** et **Hors dîner**. L’explication ICS (J-7 / H-36 / H-1h30) est dans Feedback. La phase paiement montre encore le roster « impayés » et le panneau relance en double. Pas de cron de relance STD ni de relance paiement.

**P0 fait (2026-09-26) :** le clic OUI n’envoie plus `payment_relance`. La route manuelle saute les participations déjà horodatées.

**P1 fait (2026-09-26) :** `std_relance` s’envoie depuis Qualification (une fois, liste sans réponse) ; le survey auto et manuel ne part qu’aux places payées ; `reminder_*` sort de la bibliothèque active.

`places_available` reste l’exception Prépa dîner.

## Jack findings log

| Date | P | Finding | Status |
|------|---|---------|--------|
| 2026-09-25 | P0 | Pas d’étape active dérivée | Tranche 1 done (#32) |
| 2026-09-25 | P0 | `?id=` effacé | Tranche 1 done (#32) |
| 2026-09-25 | P0 | Listes participants dupliquées | Tranche 2 done (#33) |
| 2026-09-25 | P1 | Templates diluent CTA | Tranche 2 done (#33) |
| 2026-09-25 | P0 | Labels 9 phases produit | Tranche 3 done (#34) |
| 2026-09-26 | P0 | Nav admin plate / Dashboard pas porte | Done (#35) |
| 2026-09-26 | P2 | Dashboard Approfondir + lien Tables dinner_prep | Done |
| 2026-09-26 | P0 | Files À traiter sans filtre | Done — `queue=` |
| 2026-09-26 | P1 | Pas de NBA unique / contexte Tables perdu | Done — NBA + `eventId` |
| 2026-09-26 | P0 | Dashboard trop dense / blocs blancs / pas de moment T | Done — `resolveDashboardMoment` + pastEventFocus |
| 2026-09-26 | P0 | `payment_relance` au clic YES + pas de garde anti-doublon | Fait — envoi manuel unique |
| 2026-09-26 | P1 | Relance STD custom + reminders dans « Automatiques » | Fait — `std_relance` + bibliothèque scindée |
| 2026-09-26 | P1 | Survey cron inclut `attending` (oui non payé) | Fait — places payées seulement |

## Changelog

| Date | Change |
|------|--------|
| 2026-09-25 | Bootstrap mémoire produit alignée DOC Jack |
| 2026-09-25 | Tranche 1 command center événement (#32) |
| 2026-09-25 | Tranche 2 roster unifié + template drawers (#33) |
| 2026-09-25 | Tranche 3 — 9 ops phases + Formal/Places/paiement (#34) |
| 2026-09-26 | Admin IA — Dashboard porte + Personnes onglets + nav 5 |
| 2026-09-26 | P2 — Approfondir densifié + CTAs Tables en dinner_prep |
| 2026-09-26 | Continuité — queue filters, NBA Dashboard, Tables eventId |
| 2026-09-26 | Dashboard moment T — un focus Maintenant (email / post-dîner CA+sat) |
| 2026-09-26 | Audit funnel emails : séquence canonique + écarts auto/manuel (pas de changement d’envoi) |
| 2026-09-26 | P0 relance paiement : plus d’email au clic OUI ; un seul envoi manuel par invité |
| 2026-09-26 | P1 : relance STD système, survey payés seulement, reminders archivés, Coms en deux listes |
