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
| 2026-09-26 | Statuts siège : **Payé** (`confirmed`) + **Invité** (`comped`) ; event `costMxn` + `priceMxn` ; TTC = HT + IVA 16% + service 15% | Invité = COST oui / CA non ; marge interne |
| 2026-09-26 | ACCESS = **virement bancaire uniquement** (pas de paiement en ligne sur le site) | Admin marque Payé à réception du transfer ; site affiche CLABE / infos, pas de checkout |
| 2026-09-26 | Service 15% **optionnel** par event (`priceIncludesService` / `costIncludesService`, défaut inclus) | Ajustable vente vs cost |
| 2026-09-26 | IVA 16% aussi optionnel (`priceIncludesIva` / `costIncludesIva`) ; CA dashboard = négo event (pas d’ajout auto) | Les flags event font foi |
| 2026-09-26 | Organisateur = toujours **Invité** (`comped`) : COST oui, CA non | Gregory hors places payées / CA |
| 2026-09-26 | **Évolution LA MESA** (série dîners) sur Dashboard Approfondir | Cumul CA / marge / sat / remplissage — pas seulement dernier dîner |
| 2026-09-26 | NBA **check-in** dans la fenêtre soir J (H-6 → H+18) | Étape active le jour J, pas saut direct feedback |
| 2026-09-26 | Fil personne×dîner v1 : `guestJourneyStage` sur roster | Une étape métier lisible (STD → payé → présent…) |
| 2026-09-26 | Signal membre **« J’ai effectué le virement »** (`paymentDeclaredAt`) | Déclaré ≠ Payé ; admin confirme ; exclus des relances email |

## Reusable components / patterns

- `ops-phases` + `suggestOpsPhase` + `EventCommandHeader` / `EventCommandPhaseNav`
- `AdminEventParticipantRoster` + `EventTemplateDrawer` + `guestJourneyStage`
- `mesaSeries` (évolution cumulée) · `lastEventRecap` (dernier dîner)
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
| FormalInviteOui encore panel dédié (pas fusion roster) | Done — panneau OUI seul en phase formal (interest) ; roster retiré |
| Check-in UI dédiée | Done — `checkedInAt` + panneau soir J (Payé + Invité) |
| Phase paiement roster + relance en double | Done — un seul panneau follow-up |
| Chrome Personnes vs reste (whiplash) | Done — workspace partout |
| Coms ouvre sur « créer template » | Done — envoi d’abord |
| Page publique `/e` bifurquée | Ouvert — vague 2 (garder OUI/NON ; CTA adaptatif plus tard) |
| Espace membre « mon prochain pas » | Done — survey / ACCESS / profil / prochain dîner |
| Pas d’évolution cumulée série LA MESA | Done — `mesaSeries` dashboard Approfondir |
| NBA saute check-in | Done — fenêtre soir J H-6→H+18 |
| Double modèle Audience vs playlists OUI | Ouvert — v1 = étape parcours unifiée UI ; fusion data = vague 2 |

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

Les 9 phases placent STD, qualification, invitation, paiement, places et feedback au bon endroit. Coms sépare **Funnel dîner** et **Hors dîner**. L’explication ICS (J-7 / H-36 / H-1h30) est dans Feedback. La phase paiement a un seul panneau (Confirmation & paiement + envoi relance) — plus de roster « impayés » en double. Pas de cron de relance STD ni de relance paiement.

**P0 fait (2026-09-26) :** le clic OUI n’envoie plus `payment_relance`. La route manuelle saute les participations déjà horodatées.

**P1 fait (2026-09-26) :** `std_relance` s’envoie depuis Qualification (une fois, liste sans réponse) ; le survey auto et manuel ne part qu’aux places payées ; `reminder_*` sort de la bibliothèque active.

`places_available` reste l’exception Prépa dîner.

**Dernier email (2026-09-26) :** la carte dashboard suit le tampon le plus récent sur les participations (invitation, relance paiement, confirmation, questionnaire), pas seulement l’archive du dernier appel. Les envois suivants écrivent aussi cette archive.

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
| 2026-09-26 | P1 | Pas de récap du dernier dîner sur le dashboard | Fait — 4 chiffres cliquables dans le moment « Après le dîner » |
| 2026-09-26 | P1 | Phase paiement : roster impayés + panneau relance en double | Done — un seul follow-up |
| 2026-09-26 | P1 | FormalInviteOui + roster générique en double (phase formal) | Done — panneau OUI seul |
| 2026-09-26 | P1 | Check-in placeholder / statut Présent mort (`present`→`confirmed`) | Done — `checkedInAt` |
| 2026-09-26 | P0 | Organisateur compté Payé dans CA dernier dîner | Fait (#52) |
| 2026-09-26 | P0 | CA du 24 sept. encore sur 11 (boîte LA MESA / apostrophe / double ligne) | Fait — 10 payants, 1 couvert organisateur |
| 2026-09-26 | P0 | Pas d’évolution cumulée LA MESA | Fait — série dashboard |
| 2026-09-26 | P1 | NBA saute check-in | Fait — fenêtre soir J |
| 2026-09-26 | P0 | Fil personne×dîner fragmenté | Fait v1 — journey stage roster |

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
| 2026-09-26 | Dashboard — récap cliquable du dernier dîner dans le moment « Après le dîner » : contactées, places payées, CA TTC, note |
| 2026-09-26 | Phase paiement — un seul panneau Confirmation & paiement (plus de double roster) |
| 2026-09-26 | Phase formal (interest) — panneau OUI seul, plus de roster générique en dessous |
| 2026-09-26 | Check-in soir J — tap Présent sur places payées (`checkedInAt`) |
| 2026-09-26 | Dernier email dashboard : invitation, relance paiement, confirmation et survey passent devant le dernier appel |
| 2026-09-26 | Espace membre — bloc « Mon prochain pas » (survey / ACCESS / profil) |
| 2026-09-26 | Spec Jack P0/P1 : série LA MESA + NBA check-in + guest journey stage (`docs/superpowers/specs/2026-09-26-mesa-series-checkin-journey-design.md`) |
| 2026-09-26 | Dashboard — Évolution LA MESA (CA / marge / sat / dîners) ; NBA check-in soir J ; roster affiche l’étape parcours |
| 2026-09-26 | Paiement — signal déclaré membre (`paymentDeclaredAt`) + filtre admin « Virement déclaré » + exclus relance email |
| 2026-09-26 | Récap — CA sur les payants ; un seul couvert organisateur dans le COST (mailbox LA MESA, nom avec apostrophe, lignes en double) |
