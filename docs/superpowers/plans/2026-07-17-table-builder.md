# Table Builder & Intelligence du vivier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only hybrid curation engine that analyzes Guadalajara member profiles, proposes explained table compositions of 15 primary guests plus 5 alternates, saves editable drafts, and hands approved guests to the existing event builder without sending invitations.

**Architecture:** Pure TypeScript modules build and score an eligible member pool before an OpenAI-compatible provider adds themes and explanations. Zod validates every AI and persistence boundary. A dedicated `/admin/tables` client panel consumes admin-only routes; the dashboard only lists recent drafts and links to the builder.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Firebase Admin/Firestore, Zod 4, Vitest, existing OpenAI-compatible HTTP configuration, existing `useAuthFetch` and `pending-invitees`.

## Global Constraints

- Language/locale must never affect candidate filtering or scoring.
- Full table target is exactly 15 primary members plus up to 5 ranked alternates; return fewer with a warning when the city pool is too small.
- Prefer members not invited to the most recent previous event; never hard-exclude them solely for prior invitation.
- Exclude soft-deleted members and restrict the pool to the selected city.
- Never auto-create participations, send invitations, or email from table analysis/draft routes.
- Never send email, phone, LinkedIn URL, Firebase uid, or Database Perso id to the AI provider.
- Full registration requires `canBring` and `isSeeking`; express registration remains unchanged.
- Admin can edit every proposal before saving or handing it to event creation.
- Preserve pre-existing uncommitted dashboard changes and do not stage or commit them unless explicitly requested.
- Do not create git commits unless the user explicitly requests commits.

---

## File structure

### Create

- `src/lib/admin/table-matching/types.ts` — domain types shared by matching, API, persistence, and UI.
- `src/lib/admin/table-matching/pool.ts` — city eligibility, participation history, previous-event annotation, PII-safe AI cards.
- `src/lib/admin/table-matching/score.ts` — deterministic ranking and diversity selection.
- `src/lib/admin/table-matching/schemas.ts` — Zod request, AI output, and draft mutation schemas.
- `src/lib/admin/table-matching/ai-provider.ts` — OpenAI-compatible structured JSON call.
- `src/lib/admin/table-matching/index.ts` — orchestration and normalized result assembly.
- `src/lib/admin/table-matching/pool.test.ts`
- `src/lib/admin/table-matching/score.test.ts`
- `src/lib/admin/table-matching/schemas.test.ts`
- `src/lib/admin/table-matching/ai-provider.test.ts`
- `src/lib/admin/table-drafts.ts` — Firestore serialization/normalization helpers.
- `src/lib/admin/table-drafts.test.ts`
- `src/app/api/admin/table-ideas/route.ts`
- `src/app/api/admin/table-drafts/route.ts`
- `src/app/api/admin/table-drafts/[id]/route.ts`
- `src/app/admin/tables/page.tsx`
- `src/components/admin/admin-table-builder.tsx`

### Modify

- `src/lib/types/events.ts` — profile and draft types.
- `src/lib/validation.ts` — full-registration fields.
- `src/lib/member/profile-completion.ts` and test — include both curation fields.
- `src/lib/member/sync-database-perso.ts` and test — append fields to CRM notes.
- `src/app/api/register/route.ts` — persist full-registration fields.
- `src/app/api/me/profile/route.ts` — validate and persist member edits.
- `src/components/profile-registration-form.tsx` — collect both short fields.
- `src/components/account/member-profile-panel.tsx` — edit both fields.
- `messages/es.json`, `messages/fr.json`, `messages/en.json` — localized labels and hints.
- `src/lib/firebase/admin.ts` — `tableDrafts` collection.
- `src/components/admin/admin-shell.tsx` — Tables navigation item.
- `src/lib/admin/pending-invitees.ts` and test — pure conversion/storage validation for draft handoff.
- `src/app/api/admin/dashboard/route.ts` — recent draft summaries.
- `src/components/admin/admin-dashboard.tsx` — Intelligence du vivier teaser.

---

### Task 1: Add minimal curation fields to member profiles

**Files:**
- Modify: `src/lib/types/events.ts`
- Modify: `src/lib/validation.ts`
- Modify: `src/lib/member/profile-completion.ts`
- Modify: `src/lib/member/profile-completion.test.ts`
- Modify: `src/lib/member/sync-database-perso.ts`
- Modify: `src/lib/member/sync-database-perso.test.ts`
- Modify: `src/app/api/register/route.ts`
- Modify: `src/app/api/me/profile/route.ts`
- Modify: `src/components/profile-registration-form.tsx`
- Modify: `src/components/account/member-profile-panel.tsx`
- Modify: `messages/es.json`
- Modify: `messages/fr.json`
- Modify: `messages/en.json`

**Interfaces:**
- Produces: `WaitlistRegistration.canBring?: string`
- Produces: `WaitlistRegistration.isSeeking?: string`
- Produces: full registration input fields, each trimmed and `min(2).max(280)`
- Preserves: express schema and express form unchanged

- [ ] **Step 1: Extend failing completion and CRM-sync tests**

Add assertions equivalent to:

```ts
it("counts canBring and isSeeking in profile completion", () => {
  const complete = {
    fullName: "Ana García",
    email: "ana@example.com",
    phone: "+521234567890",
    company: "Mesa Labs",
    sector: "tech",
    position: "founder",
    city: "Guadalajara",
    linkedinUrl: "https://linkedin.com/in/ana",
    invitationMotivation: "Conocer perfiles complementarios",
    extraActivities: ["Mentoría"],
    canBring: "Experiencia en producto B2B",
    isSeeking: "Socios de distribución en México",
  };
  expect(computeProfileCompletionPercent(complete)).toBe(100);
});

it("adds curation answers to Database Perso notes", () => {
  const payload = toDatabasePersoUpsertPayload({
    ...baseMember,
    canBring: "Experiencia SaaS",
    isSeeking: "Socios comerciales",
  });
  expect(payload.notes).toContain("Puede aportar: Experiencia SaaS");
  expect(payload.notes).toContain("Busca: Socios comerciales");
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- src/lib/member/profile-completion.test.ts src/lib/member/sync-database-perso.test.ts
```

Expected: FAIL because the new properties are absent from the completion and sync inputs.

- [ ] **Step 3: Add types, validation, persistence, and sync**

Implement:

```ts
// WaitlistRegistration
canBring?: string;
isSeeking?: string;

// registrationSchema
canBring: z.string().trim().min(2).max(280),
isSeeking: z.string().trim().min(2).max(280),

// profilePatchSchema
canBring: z.string().trim().max(280).optional(),
isSeeking: z.string().trim().max(280).optional(),
```

Add both fields to `PROFILE_COMPLETION_FIELDS`, `ProfileCompletionInput`, French missing-field labels, registration `record`, profile merge, `WaitlistSyncInput`, and CRM notes.

- [ ] **Step 4: Add two short localized form controls**

Full registration payload:

```ts
canBring: String(data.get("canBring") ?? "").trim(),
isSeeking: String(data.get("isSeeking") ?? "").trim(),
```

Use two required textareas with `minLength={2}`, `maxLength={280}`, and `rows={2}`. Add member-profile state and PATCH payload for both fields. Add concise ES/FR/EN keys under both `registration.fields` and `account.fields`.

- [ ] **Step 5: Verify Task 1**

Run:

```bash
npm test -- src/lib/member/profile-completion.test.ts src/lib/member/sync-database-perso.test.ts
npx tsc --noEmit
```

Expected: focused tests PASS; typecheck exits 0.

Checkpoint: inspect `git diff` only. Do not commit unless explicitly requested.

---

### Task 2: Define matching contracts and build the eligible pool

**Files:**
- Create: `src/lib/admin/table-matching/types.ts`
- Create: `src/lib/admin/table-matching/pool.ts`
- Create: `src/lib/admin/table-matching/pool.test.ts`
- Modify: `src/lib/types/events.ts`

**Interfaces:**
- Produces:

```ts
export type TableIdeaMode = "spontaneous" | "admin_theme";
export type CompletionBand = "high" | "mid" | "low";

export type TableCandidate = {
  id: string;
  fullName: string;
  email: string; // server/UI only; excluded from AI card
  company: string;
  sector: string;
  position: string;
  city: string;
  invitationMotivation: string;
  extraActivities: string[];
  canBring: string;
  isSeeking: string;
  completionPercent: number;
  completionBand: CompletionBand;
  invitationCount: number;
  invitedToPreviousEvent: boolean;
  coPresentMemberIds: string[];
  referredById?: string;
};

export type AiCandidateCard = Omit<
  TableCandidate,
  "fullName" | "email" | "coPresentMemberIds" | "referredById"
>;

export function buildEligiblePool(input: {
  members: WaitlistRegistration[];
  participations: AdminEventParticipation[];
  events: AdminEvent[];
  city: string;
  excludeMemberIds?: string[];
}): {
  candidates: TableCandidate[];
  aiCards: AiCandidateCard[];
  previousEventId: string | null;
};
```

- [ ] **Step 1: Write pool tests**

Cover:

```ts
it("filters by normalized city and soft deletion");
it("marks members invited to the latest past event");
it("matches participation by contactId before normalized email");
it("builds co-presence only from confirmed or attending guests");
it("omits PII and locale from AI cards");
it("honors explicit excludeMemberIds");
```

The PII test must assert:

```ts
expect(aiCard).not.toHaveProperty("email");
expect(aiCard).not.toHaveProperty("fullName");
expect(aiCard).not.toHaveProperty("phone");
expect(aiCard).not.toHaveProperty("linkedinUrl");
expect(aiCard).not.toHaveProperty("locale");
```

- [ ] **Step 2: Run pool tests and verify RED**

Run:

```bash
npm test -- src/lib/admin/table-matching/pool.test.ts
```

Expected: FAIL because `pool.ts` does not exist.

- [ ] **Step 3: Implement pool normalization and history joins**

Use:

```ts
const normalizeText = (value?: string | null) =>
  (value ?? "").trim().toLocaleLowerCase("es-MX");
```

Select the latest event with `startsAt < now`; prefer matching city only if an event city signal exists, otherwise use the global latest past event. Never use member locale. Resolve members by `contactId`, then normalized email. Truncate free-text fields in `AiCandidateCard` to a fixed maximum before any provider call.

- [ ] **Step 4: Verify Task 2**

Run:

```bash
npm test -- src/lib/admin/table-matching/pool.test.ts
npx tsc --noEmit
```

Expected: PASS and exit 0.

Checkpoint: inspect `git diff` only.

---

### Task 3: Implement deterministic ranking and 15+5 assembly

**Files:**
- Create: `src/lib/admin/table-matching/score.ts`
- Create: `src/lib/admin/table-matching/score.test.ts`

**Interfaces:**
- Consumes: `TableCandidate`
- Produces:

```ts
export type RankedCandidate = TableCandidate & {
  baseScore: number;
  reasons: string[];
};

export function rankCandidates(candidates: TableCandidate[]): RankedCandidate[];

export function selectBalancedTable(
  ranked: RankedCandidate[],
  options?: { primarySize?: number; alternateSize?: number },
): {
  primary: RankedCandidate[];
  alternates: RankedCandidate[];
  warnings: string[];
};
```

- [ ] **Step 1: Write scoring and selection tests**

Cover:

```ts
it("ranks a never-invited complete profile ahead of a previous-table invitee");
it("does not use locale in scoring");
it("prefers one member per normalized company");
it("soft-limits a sector to four primary seats when alternatives exist");
it("returns 15 primary and 5 alternates for a pool of 20");
it("returns all available members with a pool-too-small warning");
it("warns when a referral pair appears in primary");
```

- [ ] **Step 2: Run score tests and verify RED**

Run:

```bash
npm test -- src/lib/admin/table-matching/score.test.ts
```

Expected: FAIL because `score.ts` does not exist.

- [ ] **Step 3: Implement transparent scoring constants**

Use named constants, not hidden magic numbers:

```ts
export const TABLE_SCORE = {
  notPreviousEvent: 30,
  neverInvited: 15,
  completionHigh: 10,
  completionLow: -10,
  recentCoPresence: -6,
  duplicateCompany: -40,
  sectorOverFour: -12,
} as const;
```

Selection is greedy over ranked candidates while applying company and sector penalties against the current primary list. The constraints remain soft so small pools still produce a result.

- [ ] **Step 4: Verify Task 3**

Run:

```bash
npm test -- src/lib/admin/table-matching/score.test.ts
```

Expected: all score tests PASS.

Checkpoint: inspect `git diff` only.

---

### Task 4: Add validated AI composition and admin ideas API

**Files:**
- Create: `src/lib/admin/table-matching/schemas.ts`
- Create: `src/lib/admin/table-matching/schemas.test.ts`
- Create: `src/lib/admin/table-matching/ai-provider.ts`
- Create: `src/lib/admin/table-matching/ai-provider.test.ts`
- Create: `src/lib/admin/table-matching/index.ts`
- Create: `src/app/api/admin/table-ideas/route.ts`

**Interfaces:**
- Produces:

```ts
export const tableIdeasRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    city: z.string().trim().min(2).max(80),
    mode: z.literal("spontaneous"),
    excludeMemberIds: z.array(z.string().min(1)).max(200).default([]),
  }),
  z.object({
    city: z.string().trim().min(2).max(80),
    mode: z.literal("admin_theme"),
    theme: z.string().trim().min(3).max(500),
    excludeMemberIds: z.array(z.string().min(1)).max(200).default([]),
  }),
]);

export const aiTableIdeasSchema = z.object({
  ideas: z.array(z.object({
    title: z.string().min(3).max(120),
    themeAngle: z.string().min(3).max(300),
    rationale: z.string().min(10).max(1500),
    commonalities: z.array(z.string().min(2).max(240)).max(8),
    complementarities: z.array(z.string().min(2).max(240)).max(8),
    warnings: z.array(z.string().min(2).max(240)).max(8),
    primaryMemberIds: z.array(z.string().min(1)).max(15),
    alternateMemberIds: z.array(z.string().min(1)).max(5),
  })).min(1).max(4),
});

export async function generateTableIdeas(input: {
  mode: TableIdeaMode;
  theme?: string;
  candidates: AiCandidateCard[];
  fetchImpl?: typeof fetch;
}): Promise<z.infer<typeof aiTableIdeasSchema>>;
```

- [ ] **Step 1: Write schemas and provider tests**

Test:

```ts
it("requires a theme only in admin_theme mode");
it("rejects an AI idea with more than 15 primary ids");
it("rejects ids outside the supplied candidate set");
it("sends no contact PII in the provider request");
it("throws ai_not_configured when no AI key exists");
it("throws ai_invalid when model JSON fails the schema");
```

Inject `fetchImpl` and environment values; never perform a live model call in tests.

- [ ] **Step 2: Run Task 4 tests and verify RED**

Run:

```bash
npm test -- src/lib/admin/table-matching/schemas.test.ts src/lib/admin/table-matching/ai-provider.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement provider with existing OpenAI-compatible configuration**

Configuration precedence:

```ts
const apiKey =
  process.env.OPENAI_API_KEY?.trim() ||
  process.env.AI_GATEWAY_API_KEY?.trim() ||
  "";
const baseUrl = (
  process.env.OPENAI_BASE_URL?.trim() ||
  process.env.AI_GATEWAY_BASE_URL?.trim() ||
  "https://api.openai.com/v1"
).replace(/\/$/, "");
const model =
  process.env.OPENAI_TABLE_MODEL?.trim() ||
  process.env.AI_GATEWAY_MODEL?.trim() ||
  process.env.OPENAI_TRANSLATE_MODEL?.trim();
```

Do not introduce a hard-coded stale model id. If no model or key is configured, return `ai_not_configured`.

Request `/chat/completions` with a strict system instruction:

```text
You are a premium dinner-table curator. Return JSON only.
Use only supplied member ids. Never infer protected or personal traits.
Language is not a matching criterion.
Respect 15 primary and up to 5 alternates.
Explain shared traits and complementary contributions in French.
```

Parse markdown-fence-tolerantly, then validate with `aiTableIdeasSchema`. Reconcile model ids against the deterministic pool: remove duplicates/unknown ids, fill missing seats from `selectBalancedTable`, and append warnings.

- [ ] **Step 4: Implement authenticated route**

`POST /api/admin/table-ideas`:

1. `requirePlatformAdmin`
2. `isFirebaseAdminConfigured`
3. parse request schema
4. fetch waitlist/events/participations in parallel
5. build city pool
6. deterministic pre-rank and cap AI cards at 80
7. generate and reconcile ideas
8. map ids back to UI snapshots, including email only in the server response for event handoff

Error mapping:

```ts
validation          -> 400
pool_too_small      -> 422 only when pool is empty
ai_not_configured   -> 503
ai_invalid          -> 502
fetch_failed        -> 502
```

- [ ] **Step 5: Verify Task 4**

Run:

```bash
npm test -- src/lib/admin/table-matching
npx tsc --noEmit
```

Expected: all matching tests PASS and typecheck exits 0.

Checkpoint: inspect `git diff` only.

---

### Task 5: Persist editable table drafts

**Files:**
- Modify: `src/lib/firebase/admin.ts`
- Modify: `src/lib/types/events.ts`
- Create: `src/lib/admin/table-drafts.ts`
- Create: `src/lib/admin/table-drafts.test.ts`
- Create: `src/app/api/admin/table-drafts/route.ts`
- Create: `src/app/api/admin/table-drafts/[id]/route.ts`

**Interfaces:**
- Produces: `COLLECTIONS.tableDrafts = "table_drafts"`
- Produces: `TableDraft`, `TableDraftMemberSnapshot`, and `TableDraftStatus`
- Produces:

```ts
export const tableDraftCreateSchema: z.ZodType<...>;
export const tableDraftPatchSchema: z.ZodType<...>;
export function normalizeTableDraft(id: string, data: unknown): TableDraft;
```

- [ ] **Step 1: Write draft schema tests**

Cover:

```ts
it("accepts 15 unique primary and up to 5 unique alternates");
it("rejects a member present in both primary and alternates");
it("rejects duplicate member ids");
it("rejects used status without linkedEventId");
it("normalizes Firestore data with stable defaults");
```

- [ ] **Step 2: Run draft tests and verify RED**

Run:

```bash
npm test -- src/lib/admin/table-drafts.test.ts
```

Expected: FAIL because draft helpers do not exist.

- [ ] **Step 3: Implement schemas and CRUD routes**

`GET /api/admin/table-drafts?status=draft` lists newest first, default excludes archived, limit 50.

`POST /api/admin/table-drafts` validates, adds:

```ts
{
  ...parsed.data,
  status: "draft",
  createdAt: now,
  updatedAt: now,
  createdByUid: admin.uid,
  createdByEmail: admin.email,
}
```

`PATCH /api/admin/table-drafts/[id]` validates allowed edits and timestamps them. `DELETE` archives via `{ status: "archived", updatedAt }`; no hard deletion.

- [ ] **Step 4: Verify Task 5**

Run:

```bash
npm test -- src/lib/admin/table-drafts.test.ts
npx tsc --noEmit
```

Expected: PASS and exit 0.

Checkpoint: inspect `git diff` only.

---

### Task 6: Build `/admin/tables` and event handoff

**Files:**
- Create: `src/app/admin/tables/page.tsx`
- Create: `src/components/admin/admin-table-builder.tsx`
- Modify: `src/components/admin/admin-shell.tsx`
- Modify: `src/lib/admin/pending-invitees.ts`
- Create: `src/lib/admin/pending-invitees.test.ts`

**Interfaces:**
- Consumes: `POST /api/admin/table-ideas`
- Consumes: `GET|POST|PATCH /api/admin/table-drafts`
- Consumes: `setPendingInvitees`
- Produces:

```ts
export function tableMembersToPendingInvitees(
  members: TableIdeaMember[],
): PendingInvitee[];
```

- [ ] **Step 1: Write handoff test**

```ts
it("converts only primary members to waitlist pending invitees", () => {
  expect(tableMembersToPendingInvitees(primary)).toEqual([
    {
      email: "ana@example.com",
      fullName: "Ana García",
      companyName: "Mesa Labs",
      contactId: "member-1",
      source: "waitlist",
      inviteAs: "invited",
    },
  ]);
});
```

Also test missing/invalid email is excluded.

- [ ] **Step 2: Run handoff test and verify RED**

Run:

```bash
npm test -- src/lib/admin/pending-invitees.test.ts
```

Expected: FAIL because converter does not exist.

- [ ] **Step 3: Implement page and client states**

Page pattern:

```tsx
export default function AdminTablesPage() {
  return (
    <AdminShell title="Tables">
      <AdminTableBuilder />
    </AdminShell>
  );
}
```

Builder states:

```ts
type LoadState = "idle" | "loading" | "success" | "error";
const [city, setCity] = useState("Guadalajara");
const [mode, setMode] = useState<TableIdeaMode>("spontaneous");
const [theme, setTheme] = useState("");
const [ideas, setIdeas] = useState<TableIdea[]>([]);
const [selectedIdeaIndex, setSelectedIdeaIndex] = useState(0);
const [drafts, setDrafts] = useState<TableDraft[]>([]);
```

UI requirements:

- City input/select, mode toggle, theme field shown only for `admin_theme`.
- Explicit “Analyser” button; do not run AI on every keystroke.
- Idea list + selected detail.
- Primary and alternate lists with remove and swap actions.
- Commonalities, complementarities, and warnings visible.
- Save draft button.
- “Créer un événement” saves `primary` via `setPendingInvitees` then routes to `/admin/evenements?nouveau=1`.
- No send-invitations call anywhere in this component.
- “Ajouter à un événement existant” opens an event select populated from `GET /api/admin/events`, then posts primary members to `POST /api/admin/events/[id]/invitees`; show `added`, `skipped`, and `waitlisted` counts returned by the route.

- [ ] **Step 4: Add Tables navigation and `?generate=1` behavior**

Add `{ href: "/admin/tables", label: "Tables" }` to `ADMIN_NAV`. On builder mount, `?generate=1` may focus the generation controls but must not spend an AI call without an explicit click.

- [ ] **Step 5: Verify Task 6**

Run:

```bash
npm test -- src/lib/admin/pending-invitees.test.ts
npx tsc --noEmit
npm run lint -- src/app/admin/tables/page.tsx src/components/admin/admin-table-builder.tsx src/components/admin/admin-shell.tsx src/lib/admin/pending-invitees.ts
```

Expected: tests PASS, typecheck and lint exit 0.

Checkpoint: inspect `git diff` only.

---

### Task 7: Add dashboard Intelligence du vivier teaser

**Files:**
- Modify: `src/app/api/admin/dashboard/route.ts`
- Modify: `src/components/admin/admin-dashboard.tsx`

**Interfaces:**
- Dashboard payload adds:

```ts
recentTableDrafts?: Array<{
  id: string;
  title: string;
  city: string;
  primaryCount: number;
  alternateCount: number;
  updatedAt: string;
}>;
```

- [ ] **Step 1: Extend dashboard route**

Fetch up to 3 non-archived drafts in the existing dashboard `Promise.all`. If Firestore composite ordering would require an index, fetch recent by `updatedAt desc` and filter archived in memory. Return summary only, not full member snapshots.

- [ ] **Step 2: Add dashboard section after Répartition**

Render:

- Heading “Intelligence du vivier”
- Up to three recent draft cards
- Empty state when no drafts exist
- “Ouvrir le Table Builder” → `/admin/tables`
- “Générer des idées” → `/admin/tables?generate=1`

Do not call the model from dashboard load.

- [ ] **Step 3: Verify Task 7 and preserve current work**

Run:

```bash
npx tsc --noEmit
npm run lint -- src/app/api/admin/dashboard/route.ts src/components/admin/admin-dashboard.tsx
git diff -- src/app/api/admin/dashboard/route.ts src/components/admin/admin-dashboard.tsx
```

Expected: typecheck/lint exit 0. Review the diff carefully because both files already contained uncommitted user work before this plan.

Checkpoint: do not stage or commit.

---

### Task 8: Full verification and privacy audit

**Files:**
- Review all files from Tasks 1–7
- Do not modify `tsconfig.tsbuildinfo` intentionally

- [ ] **Step 1: Run the full automated suite**

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Expected: every command exits 0.

- [ ] **Step 2: Static privacy and side-effect checks**

Search:

```bash
rg -n "email|phone|linkedinUrl|locale|uid|databasePerso" src/lib/admin/table-matching
rg -n "send-invitations|sendWaitlist|send.*Email" src/app/api/admin/table-ideas src/app/api/admin/table-drafts src/components/admin/admin-table-builder.tsx
```

Expected:

- Contact fields may appear only in server/UI member snapshots and explicit redaction tests, never in `AiCandidateCard` or model request body.
- No invitation/email sender appears in ideas, drafts, or builder code.
- `locale` is not referenced by pool/scoring implementation except a test proving it is ignored.

- [ ] **Step 3: Manual admin smoke test**

With local Firebase/admin auth configured:

1. Open `/admin/tables`.
2. Generate spontaneous Guadalajara ideas.
3. Confirm 15 primary + 5 alternates when pool allows.
4. Confirm explanations name common and complementary traits.
5. Swap/remove members and save a draft.
6. Reload and reopen the draft.
7. Click “Créer un événement”.
8. Confirm `/admin/evenements?nouveau=1` opens with primary members prefilled.
9. Confirm no participation or email is created until the existing event save/invitation flow is used.
10. Open `/admin/dashboard` and confirm the saved draft appears under Intelligence du vivier.

- [ ] **Step 4: Review final diff**

```bash
git status --short
git diff --stat
git diff
```

Confirm no unrelated files or secrets are included. Restore generated `tsconfig.tsbuildinfo` only if it was changed by verification and only without overwriting pre-existing user changes.

Do not commit or push unless the user explicitly requests it.
