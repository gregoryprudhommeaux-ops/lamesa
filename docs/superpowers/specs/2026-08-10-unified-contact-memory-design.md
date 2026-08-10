# Unified contact memory (timeline + stats)

**Date:** 2026-08-10  
**Status:** approved for implementation after user review of this file  
**Decisions:** identity = email (C) · v1 = read existing + write journal (B) · UI entry = Prospects + Membres (C) · architecture = activities collection + hybrid read (approche 1)

## Goal

Attach a durable interaction history to every person who touches LA MESA (prospect and/or platform member), keyed by normalized email. Show the same fiche from Prospects CRM and Admin waitlist/members. Enable future automated relances from this memory.

## Non-goals (v1)

- Manual activity entry (call / WhatsApp / note) — later
- Manual revenue outside dinner seats — later
- One-shot historical backfill job into `contact_activities` (past data is **derived** at read time)
- Database Perso live sync of the timeline
- Merging people with different emails into one identity

## Identity

- Canonical key: `normalizeEmail(email)` (trim, lower, strip `mailto:`).
- Fiche resolves:
  - `prospect` via `la_mesa_prospects` (if any, not soft-deleted)
  - `waitlist` via `la_mesa_waitlist` (if any, not soft-deleted)
  - activities via `la_mesa_contact_activities` where `email == key`
  - derived rows from waitlist stamps + `event_participations` (+ event titles/prices)
- No mandatory `Person` document in v1.

## Collection: `la_mesa_contact_activities`

Append-only journal. Add to `COLLECTIONS` as `contactActivities: "la_mesa_contact_activities"`.

### Document shape

```ts
type ContactActivity = {
  id: string;
  email: string; // normalized
  type: ContactActivityType;
  at: string; // ISO
  source: "system" | "admin" | "guest";
  summary: string; // short FR label for UI
  refs?: {
    eventId?: string;
    participationId?: string;
    prospectId?: string;
    waitlistId?: string;
    templateKey?: string;
    listName?: string;
  };
  meta?: Record<string, string | number | boolean | null>;
  createdAt: string; // write time
};
```

### Activity types (v1)

| type | When written |
|------|----------------|
| `added_prospect` | Prospect created (not merge-only fill) |
| `registered_platform` | Waitlist register / light signup |
| `email_sent` | Cold send, welcome, invite blast, confirmation, nudges (when already stamped today) |
| `list_added` | Bulk/manual add to prospect list |
| `status_changed` | Prospect status change (incl. cold → contacted) |
| `invited_event` | Added as invitee / calendar invite sent |
| `rsvp_yes` | Guest RSVP attending |
| `rsvp_no` | Guest RSVP not_attending |
| `confirmed_seat` | Admin/system sets participation `confirmed` |
| `seen_marked` | Prospect `seen: true` |

Index: query by `email` + `at` desc (composite if needed; v1 may filter in memory for a single email).

## Hybrid read (timeline)

On `GET /api/admin/contacts/by-email?email=…` (or `/api/admin/contacts/[email]`):

1. Load prospect + waitlist by email.
2. Load activities for email (limit e.g. 500).
3. Build **derived** timeline items from existing data (for history before writers existed):
   - Waitlist `createdAt` → `registered_platform`
   - Waitlist `welcomeEmailSentAt` / FN / incomplete nudge stamps → `email_sent`
   - Prospect `createdAt` → `added_prospect`
   - Prospect `lastContactedAt` → `email_sent` (cold, if no matching activity)
   - Each participation → `invited_event` / `rsvp_yes` / `rsvp_no` / `confirmed_seat` according to status + timestamps (`createdAt`, `rsvpAt`, `confirmationEmailSentAt`, etc.)
4. Merge + **dedupe**: same `type` + same primary ref (`eventId` / `templateKey`) + same calendar day → keep written activity preferentially.
5. Sort by `at` descending.

## Stats (header KPIs)

Reuse / extend `member-engagement` logic, scoped to one email:

| KPI | Definition |
|-----|------------|
| `addedAt` | prospect.createdAt |
| `registeredAt` | waitlist.createdAt |
| `invitationsCount` | participations counting as invitation pathway (excl. organizers) |
| `confirmedCount` | status `confirmed` |
| `declinedCount` | status `not_attending` |
| `revenueMxn` | sum over confirmed non-organizer seats of `priceMxn` + 16% IVA (same as today) |
| `lastOutreachAt` | max of written `email_sent.at` and prospect.lastContactedAt |
| `events` | list `{ eventId, title, date, status }` |

## Writers (must not fail the primary action)

Helper `recordContactActivity(input)` — fire-and-log-error; never throw to caller if write fails (or soft-fail after main txn).

Hook points:

- `POST /api/register` (+ light) → `registered_platform`
- Prospect upsert create → `added_prospect`; bulk `addLists` → `list_added`; status/seen → `status_changed` / `seen_marked`
- Cold outreach success per recipient → `email_sent` + existing mark contacted
- Admin invitees add / send invitations / participation invite → `invited_event` (+ `email_sent` when mail sent)
- RSVP route → `rsvp_yes` / `rsvp_no`
- Participation PATCH → `confirmed` → `confirmed_seat` (+ confirmation `email_sent` if sent)

## API

- `GET /api/admin/contacts/by-email?email=` → `{ ok, email, prospect, waitlist, stats, timeline }`
- Optional later: `POST` manual activity (out of v1)

Admin-only (`requirePlatformAdmin`).

## UI

Shared component e.g. `ContactMemoryPanel` / `AdminContactFiche`:

1. Identity block (name, email, company; badges Prospect / Membre)
2. KPI strip (invites, confirmed, declined, CA, dates)
3. Event history table (which dinners, when, status)
4. Timeline (chronological, type icon + summary + date)

**Entry points (v1 both):**

- `/admin/prospects` — row action / click opens fiche (drawer or route `/admin/contacts?email=`)
- Admin registrants / members — same fiche for that email

Prefer a dedicated route `/admin/contacts?email=` so both shells deep-link.

## Security / privacy

- Admin-only. No member-facing timeline.
- Soft-deleted prospect/waitlist: still show activities if email known, but mark source as deleted in UI.

## Testing

- Unit: normalize email; merge/dedupe timeline; stats for one email with mixed participations.
- Optional API test with mocked Firestore if pattern exists.

## Rollout

1. Types + store + record helper + GET by-email  
2. Wire writers (register, cold, invite/RSVP, prospect bulk)  
3. Shared fiche UI + Prospects + Membres entry  
4. Docs update (`docs/prospects-crm.md` pointer)

## Success criteria

- Opening a contact from Prospects or Membres shows the same stats + timeline for that email.
- After a cold send / RSVP / register, a new activity row appears without losing derived history.
- CA and attendance counts match current engagement semantics for confirmed seats.
