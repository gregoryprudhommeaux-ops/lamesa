# LA MESA — Operating layer plan

Locked decisions (2026-07-24):

| # | Choice | Meaning |
|---|--------|---------|
| 1A | Extend LA MESA admin | No new app |
| 2A | Notes + member prioritization first | Cockpit before drafts/digests |
| 3A | Database Perso = personal CRM; LA MESA = SOT members/events | One-way upsert unchanged |
| 4A | Drafts only, manual send (v1) | No custom autonomous outreach |
| 5A | Personal Secretary out of scope | No Telegram/Gmail bridge |

## North star

Semi-autonomous **ops support** around relationships and tables — not an AI founder, not a second CRM.

## Phase 1 (this sprint) — Cockpit ✅

1. `opsNotes`, `opsPriority`, `opsTags` on waitlist members
2. Admin fiche: edit notes / priority / tags (`PATCH /api/admin/waitlist/[id]`)
3. Dashboard queues: incomplete, never invited, à revoir, prioriser, no-show

## Phase 2 (after Phase 1 is used live)

- `OpsTask` lite
- MessageDraft UI (copy-only; send manual)
- Soft J+7 only if re-requested

## Out of scope v1

Multi-agent runtime, Make/n8n, Perso notes sync, Personal Secretary, VIP auto-send, public apply-to-table link.

## Source of truth

- Members / events / participations → Firestore LA MESA
- Personal multi-app contacts → Database Perso
- Voice / copy quality → Lucy + anti-linkedin-slop (Cursor skills)

## Human-in-the-loop (v1)

- Transactional templates already live: OK automated
- Custom outreach: draft → human send only
- Table invites: keep `humanValidatedAt`
