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

_Owner, statuses, relations — refine as Jack audits deepen._

## UX/UI principles (project-specific)

- Centre de commande par phase (pas fiche événement infinie)
- Next best action + blocages visibles
- FR / EN / ES
- Mémoire contact : ne pas mélanger déclaré / observé / inféré

## Validated decisions

| Date | Décision | Raison |
|------|----------|--------|
| 2026-09-25 | Agent Jack v2 + `PROJECT_MEMORY.md` | Capitaliser parcours + mémoire relationnelle |

## Reusable components / patterns

_Admin shell, RequireAuth, table builder, email templates, contact fiche — document patterns Jack validates._

## Data, signals & governance

| Couche | Sources actuelles | Gaps |
|--------|-------------------|------|
| Base | Waitlist / prospects | |
| Historique | Activities, RSVP, emails, satisfaction | |
| Enrichie | Completion %, engagement heuristics | Inférences souvent non étiquetées |
| Gouvernance | Source tags, timestamps | Consentement / fiabilité peu visibles UI |

**Epistemic rule:** déclaré · observé · calculé · inféré (+ confiance + source).

## Known UX/product debt

_À remplir après audits Jack (P0–P3)._

## Metrics / signals to watch

Conversion profil · taux réponse intérêt · confirmation · paiement · satisfaction · relances en retard.

## Learnings transferable to other products

- Command center + active phase (ops tools)
- Insight contact format (CRM / Database Perso)
- Progressive disclosure over “all modules equal”

## Open questions / hypotheses

_À tester._

## Jack findings log

| Date | P | Finding | Status |
|------|---|---------|--------|

## Changelog

| Date | Change |
|------|--------|
| 2026-09-25 | Bootstrap mémoire produit alignée DOC Jack |
