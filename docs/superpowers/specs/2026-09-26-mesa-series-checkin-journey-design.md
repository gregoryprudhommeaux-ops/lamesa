# Design — Évolution LA MESA + NBA check-in + fil personne×dîner (v1)

Date: 2026-09-26  
Contexte: audit Jack — avancer P0/P1 sans refonte.

## Objectif

Que le backend aide l’admin à **piloter la maison** (série de dîners) et le **soir J**, pas seulement le dernier envoi.

## Scope v1 (cette itération)

### A. Évolution cumulée LA MESA (P0)

- Nouveau agrégat `mesaSeries` sur `/api/admin/dashboard`
- Pour chaque dîner passé (non-draft) : payés, invités (comped+org), CA TTC, COST, marge, sat moyenne, taux remplissage
- Totaux série + liste chronologique (plus récent en premier, max ~12)
- UI Dashboard → Approfondir : carte « Évolution LA MESA » (totaux + mini-liste CA/sat par dîner)

### B. NBA check-in (P1)

- `suggestOpsPhase` propose `checkin` quand :
  - pas d’impayés bloquants après invite formelle
  - fenêtre soir J : [H-6h … H+18h]
  - au moins une place tenue (Payé/Invité, hors org) sans `checkedInAt`
- Sinon, après fenêtre / tout check-in → feedback comme aujourd’hui

### C. Fil personne×dîner — étape de parcours (P0 partial)

- Helper `resolveGuestJourneyStage(participation)` → étape métier unique
- Affichage sous le nom dans le roster unifié (Audience / listes)
- Étapes : Waitlist · Sélectionné · STD · OUI · Invité formel · À payer · Payé · Invité (offert) · Présent · Feedback · Out

## Hors scope v1

- Fusion data participations ↔ playlists prospects
- Signal « j’ai viré » membre
- Scores d’audience / matching dans Audience
- Courbes chart.js (liste + totaux suffisent)

## Vérification

- Unit tests mesa-series + suggestOpsPhase check-in + guest-journey
- Dashboard : carte série visible si ≥1 dîner passé
- Event proche H0 : NBA = Check-in
