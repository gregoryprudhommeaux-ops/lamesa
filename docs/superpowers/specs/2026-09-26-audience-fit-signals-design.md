# Design — Audience fit signals (v1)

Date: 2026-09-26  
Suite Jack P2 — aide au choix d’invités sans refonte.

## Objectif

Dans Audience / ContactPicker, montrer **pourquoi** inviter quelqu’un : signaux **observés** (pas un score IA opaque).

## Scope v1

- Lib `resolveAudienceFitSignals` / `buildAudienceFitIndex`
- Chips sous chaque ligne waitlist dans le modal ContactPicker
- Signaux : jamais invité · déjà venu / N dîners payés · invité jamais payé · sat · ville · profil %
- Contexte : `eventCity` + exclusion du dîner courant

## Hors scope

- Fusion playlists OUI ↔ participations (vague 3)
- Ranking auto / “top 15 à inviter”
- Scores table-matching (composition ≠ sélection)

## Suite (bridge intérêt)

Chips OUI/NON sur roster + ContactPicker via `interest-display` / `/interest-status` (join email) — PR Audience↔intérêt.

## Vérif

- Unit tests audience-fit
- Ouvrir Audience → Ajouter contacts → chips visibles sur waitlist
