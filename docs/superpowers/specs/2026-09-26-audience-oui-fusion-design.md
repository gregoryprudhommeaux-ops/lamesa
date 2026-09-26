# Design — Fusion Audience ↔ OUI (vague 3)

Date: 2026-09-26  
Suite Jack — après bridge chips (#57) et Formal union (#61).

## Objectif

Les OUI (formulaire ∪ playlist CRM) **apparaissent sur le roster Audience** sans ajout manuel ContactPicker.

## Scope v1

1. **Upsert participations** depuis le pool OUI :
   - crée `attending` si absent
   - promote `waitlist` / `invited` (sans invite formelle) → `attending`
   - ne dégrade jamais Payé / Invité / Out / déjà invité formel
2. **Déclencheurs** : `POST sync-interest-lists` + submit formulaire intérêt = yes
3. **Filtres roster** : chips OUI / NON / AUTRE / Sans réponse (join email existant)

## Hors scope

- Fusion Firestore unique (respondents / prospects / participations restent séparés)
- Auto-status NON → `not_attending`
- Ranking Audience

## Vérif

- Unit : plan upsert OUI
- Sync → OUI sans participation apparaissent en Audience
- Formulaire OUI → participation `attending`
- Filtres intérêt sur roster
