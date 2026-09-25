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

1. Préparation  
2. Sélection audience  
3. Save the Date  
4. Qualification & sélection  
5. Invitation formelle  
6. Confirmation & paiement  
7. Préparation du dîner  
8. Check-in & expérience  
9. Feedback, analyse & réactivation  

## Business objects & lifecycle

Événement · Contact/waitlist · Prospect · Participation · Paiement · Communication/template · Waitlist/places · Feedback/satisfaction · Tâche ops (implicite).

## UX/UI principles (project-specific)

- Centre de commande par phase (pas fiche événement infinie)
- Next best action + blocages visibles
- Roster participants unifié + filtres
- Templates email en drawer (CTA Envoyer reste primaire)
- FR / EN / ES
- Mémoire contact : ne pas mélanger déclaré / observé / inféré

## Validated decisions

| Date | Décision | Raison |
|------|----------|--------|
| 2026-09-25 | Agent Jack v2 + `PROJECT_MEMORY.md` | Capitaliser parcours + mémoire relationnelle |
| 2026-09-25 | Command center événement tranches 1–2 | Étape active + roster + drawers |

## Reusable components / patterns

- `suggestOpsPhase` + `EventCommandHeader` / `EventCommandPhaseNav`
- `AdminEventParticipantRoster` + `EventTemplateDrawer`
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
| Monolithe `admin-events.tsx` | En cours — shell + roster |
| FormalInviteOui / Places encore séparés du roster | Ouvert |
| Labels 9 phases produit | Ouvert |
| Page publique `/e` bifurquée | Ouvert — vague 2 |

## Jack findings log

| Date | P | Finding | Status |
|------|---|---------|--------|
| 2026-09-25 | P0 | Pas d’étape active dérivée | Tranche 1 done (#32) |
| 2026-09-25 | P0 | `?id=` effacé | Tranche 1 done (#32) |
| 2026-09-25 | P0 | Listes participants dupliquées | Tranche 2 done |
| 2026-09-25 | P1 | Templates diluent CTA | Tranche 2 done |

## Changelog

| Date | Change |
|------|--------|
| 2026-09-25 | Bootstrap mémoire produit alignée DOC Jack |
| 2026-09-25 | Tranche 1 command center événement (#32) |
| 2026-09-25 | Tranche 2 roster unifié + template drawers |
