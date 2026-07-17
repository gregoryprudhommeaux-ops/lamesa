# Table Builder & Intelligence du vivier — design

Date: 2026-07-17

## Goal

Give the admin an AI-assisted curation tool that:

1. Analyzes registered waitlist profiles and surfaces **coherences** (shared traits) and **complementarities**.
2. Suggests **table themes** from the pool and/or from an admin-provided theme.
3. Produces editable **table drafts**: **15 primary guests + 5 ranked alternates**, with a clear explanation of why those people belong together.
4. Never auto-invites — admin always reviews, adjusts, and saves.

## Product decisions

| Topic | Choice |
|-------|--------|
| Placement | Dashboard teaser section + dedicated `/admin/tables` page |
| Language in matching | **Excluded** (Spanish dominates; everyone speaks it) |
| Pool default | Active waitlist members in the chosen city; soft-deleted excluded |
| Invitation priority | Prefer people **not invited to the previous table** (most recent prior event in that city when identifiable; else most recent prior event overall) |
| Composition size | 15 primary + 5 ranked alternates |
| Theme modes | Both: spontaneous ideas from the pool **and** admin-entered theme |
| Output action | Save as **draft** (editable); optional handoff to event creation via existing `pending-invitees` |
| Auto-invite | **Never** |
| Profile enrichment | Two short fields: `canBring`, `isSeeking` on full registration + member profile edit |
| Express signup | Unchanged (minimal); new fields filled later in `/compte` |
| AI stack | Reuse existing OpenAI-compatible `fetch` helper pattern (`translate-template.ts` env vars); structured JSON validated with Zod. No public AI endpoints. |

## Out of scope (v1)

- Automatic invitation or email blast from a draft
- Learning loop from post-dinner satisfaction → model weights
- Pairwise “do not seat with” exclusions UI (type may exist later; not in v1)
- Dedicated `seniority` enum (proxy remains `position`)
- Putting the full builder inside the event create form
- Sending full email/phone to the LLM

---

## Architecture

```
┌─────────────────────┐     ┌──────────────────────────┐
│ Admin Dashboard     │────▶│ /admin/tables            │
│ Intelligence teaser │     │ Table Builder UI         │
└─────────────────────┘     └────────────┬─────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
           GET /api/admin/      POST /api/admin/      POST /api/admin/
           table-drafts         table-ideas           table-drafts
           (list)               (analyze + AI)        (save draft)
                    │                    │
                    │                    ▼
                    │         lib/admin/table-matching/
                    │         - pool filter
                    │         - deterministic score
                    │         - AI theme + narrative
                    │                    │
                    ▼                    ▼
              Firestore              LLM (OpenAI /
              table_drafts           AI Gateway)
```

Handoff to events (optional):

```
Draft (15+5) → setPendingInvitees() → /admin/evenements?nouveau=1
  → ContactPicker prefilled (existing path)
```

Applying a draft to an **existing** event uses the same modal pattern as Membres → `POST /api/admin/events/[id]/invitees`.

---

## Data model

### Waitlist profile additions

Extend `WaitlistRegistration`:

```ts
canBring?: string;   // short free text — what I can bring to a table
isSeeking?: string;  // short free text — what I am looking for
```

Constraints:

- Max length ~280 characters each (short, not a survey).
- Required on **full** `/inscription` only.
- Optional on express until profile completion.
- Editable in member account profile panel.
- Included in profile completion % (update `PROFILE_COMPLETION_FIELDS`).
- Synced to Database Perso notes when sync runs (append in notes; do not invent new CRM fields unless already supported).

### Table draft document

New Firestore collection: `table_drafts` (add to `COLLECTIONS`).

```ts
interface TableDraft {
  id: string;
  title: string;                 // theme title
  themeAngle: string;            // short angle / hook
  city: string;
  mode: "spontaneous" | "admin_theme";
  adminThemeInput?: string;      // if mode === admin_theme
  rationale: string;             // why this table works
  commonalities: string[];       // shared points
  complementarities: string[];   // complementary points
  warnings: string[];
  primaryMemberIds: string[];    // length 15 target
  alternateMemberIds: string[];  // length ≤ 5, ranked
  memberSnapshots: Array<{       // denormalized for stable UI if profile changes
    id: string;
    fullName: string;
    company: string;
    sector: string;
    position: string;
    city: string;
    role: "primary" | "alternate";
    rank: number;
  }>;
  status: "draft" | "used" | "archived";
  linkedEventId?: string;
  createdAt: string;
  updatedAt: string;
  createdByUid?: string;
  createdByEmail?: string;
}
```

Server-only access (Admin SDK), same pattern as waitlist.

---

## Matching algorithm (hybrid)

### Step 1 — Build eligible pool

Inputs: `city` (required), optional `themeHint`, optional `excludeMemberIds`.

Include if:

- not soft-deleted (`deletedAt` absent)
- city matches (normalized trim / case-insensitive; allow alias map later if needed)
- waitlist row exists

Annotate each candidate with:

- invitation history from `event_participations` (by `contactId` or email)
- whether invited to **previous table** (most recent prior event, prefer same city when event has city signal; else global most recent past event)
- profile completion %, express flag
- `sector`, `position`, `company`, `extraActivities`, `invitationMotivation`, `canBring`, `isSeeking`
- co-presence set: member ids already confirmed/attending together on past events

### Step 2 — Deterministic pre-score

Score boosts / penalties (tunable constants in `lib/admin/table-matching/score.ts`):

| Signal | Effect |
|--------|--------|
| Not invited to previous table | Strong boost |
| Never invited | Moderate boost |
| Completion ≥ 80% | Boost |
| Express / completion < 50% | Soft penalty + warning if selected |
| Same company already in selection | Hard prefer max 1; penalty if forced |
| Sector diversity | Soft prefer spread (avoid &gt; ~4 of same sector in 15) |
| Position mix (founder/investor/operator) | Soft boost for complementarity |
| Co-presence on recent dinner | Soft penalty (variety) unless theme needs continuity |
| Referral pair (parrain/filleul) both in primary 15 | Warning only in v1 (no hard block) |

Language / locale: **ignored**.

### Step 3 — AI enrichment

Call LLM with **anonymized** candidate cards:

- `id`, `sector`, `position`, `company` (name ok), `city`, truncated texts for motivation / activities / canBring / isSeeking, invitation flags, completion band (`high|mid|low`)

Never send: phone, email, LinkedIn URL, uid.

Two modes:

1. **Spontaneous** — ask for 2–4 table ideas; each idea returns theme + member id lists + rationale.
2. **Admin theme** — given theme text, compose one best table of 15+5 from the pool.

Server validates AI JSON with Zod. Invalid / incomplete → `502` with `error: "ai_invalid"` (no best-effort garbage).

Deterministic scorer remains source of truth for hard constraints; AI may reorder within soft preferences and must explain commonalities/complementarities in French (admin UI language).

### Step 4 — Assemble response

Normalize to:

- `primary` (exactly 15 when pool allows; fewer + warning if pool too small)
- `alternates` (up to 5)
- `warnings[]`
- narrative fields for UI

---

## APIs

All require `requirePlatformAdmin`.

### `POST /api/admin/table-ideas`

Body:

```json
{
  "city": "Guadalajara",
  "mode": "spontaneous" | "admin_theme",
  "theme": "optional string when admin_theme",
  "excludeMemberIds": []
}
```

Response:

```json
{
  "ok": true,
  "ideas": [
    {
      "title": "...",
      "themeAngle": "...",
      "rationale": "...",
      "commonalities": ["..."],
      "complementarities": ["..."],
      "warnings": ["..."],
      "primary": [{ "id": "...", "rank": 1, "...snapshot fields" }],
      "alternates": [{ "id": "...", "rank": 1, "..." }]
    }
  ],
  "poolSize": 120,
  "previousEventId": "..."
}
```

### `GET /api/admin/table-drafts`

List drafts (status filter optional). Newest first.

### `POST /api/admin/table-drafts`

Save a draft from an idea or after manual edit (member id arrays + narrative fields).

### `PATCH /api/admin/table-drafts/[id]`

Update members / text / status (`draft` | `used` | `archived`). Optional `linkedEventId`.

### `DELETE /api/admin/table-drafts/[id]`

Hard delete or archive (prefer status `archived`).

Dashboard teaser may call a lighter `GET /api/admin/table-ideas/preview` **or** reuse last drafts + a single spontaneous call cached briefly — prefer **listing recent drafts** on dashboard load and a CTA to generate, to avoid slow dashboard.

---

## UI

### Dashboard (`admin-dashboard.tsx`)

New section **after** « Répartition membres »:

- Title: « Intelligence du vivier »
- Short copy: idées de tables à partir des profils
- Cards: up to 3 recent drafts or empty state
- Primary CTA: « Ouvrir le Table Builder » → `/admin/tables`
- Secondary: « Générer des idées » (navigates to builder with `?generate=1`)

Do not embed the full builder on the dashboard.

### `/admin/tables`

New page + `admin-table-builder.tsx` panel. Nav entry in `admin-shell.tsx`: **Tables**.

Layout:

1. Controls: city select, mode toggle (idées libres / thème saisi), theme textarea, « Analyser »
2. Results list of ideas (cards)
3. Detail pane for selected idea:
   - theme + rationale
   - commonalities / complementarities
   - primary 15 list (remove / swap with alternate)
   - alternates 5
   - warnings
   - actions: Enregistrer brouillon · Créer un événement · Ajouter à un événement existant

Reuse UI patterns from dashboard (`rounded-2xl`, `BTN_*`, labels from `waitlist-labels-fr`).

### Registration & profile

- Full form: two short textareas after interests / before or after motivation.
- Member profile panel: same two fields.
- i18n keys in `registration` + `account` namespaces (es/fr/en).
- Express: no new required fields.

---

## Privacy & safety

- Admin-only APIs.
- LLM payload redacts PII contact channels.
- Cap candidates sent to the model (e.g. top 80 by deterministic pre-rank if pool larger).
- Log errors server-side; never return raw model dump to client on failure.

---

## Testing

Vitest (pure logic under `src/lib/admin/table-matching/`):

- pool filter (city, soft-delete, previous-invite priority)
- score: company collision, sector spread, completion bands
- Zod schema accept/reject fixtures for AI output
- draft assemble when pool < 15

No live LLM in unit tests (mock provider).

---

## Rollout plan

1. **Schema + forms** — `canBring` / `isSeeking` + completion + i18n
2. **Matching lib + APIs** — pool, score, ideas endpoint with mocked AI in tests
3. **AI wiring** — real provider using existing env keys; Zod gate
4. **Admin UI** — `/admin/tables` + dashboard teaser + nav
5. **Drafts persistence** — Firestore CRUD + handoff to `pending-invitees`

Success criteria for v1:

- Admin can generate ≥1 coherent table idea for Guadalajara from current waitlist.
- Each idea shows explicit common / complementary reasons.
- Draft save + reopen works.
- Handoff creates event with ContactPicker prefilled.
- No invite emails sent without the existing invitation flow.
