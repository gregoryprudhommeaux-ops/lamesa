# Unified Contact Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each LA MESA contact (prospect and/or waitlist member) a unified admin fiche with KPIs + hybrid timeline, keyed by email, writable for future actions.

**Architecture:** Append-only `la_mesa_contact_activities` + hybrid GET that merges written activities with derived history from waitlist/participations/prospects. Shared fiche UI linked from Prospects and Membres.

**Tech Stack:** Next.js App Router, Firebase Admin Firestore, Vitest, existing admin auth (`requirePlatformAdmin`).

**Spec:** `docs/superpowers/specs/2026-08-10-unified-contact-memory-design.md`

## Global Constraints

- Identity key = normalized email only (no Person mega-doc in v1).
- Writers must not break primary actions (soft-fail activity writes).
- CA = confirmed non-organizer seats × priceMxn + 16% IVA (same as `member-engagement`).
- Admin-only APIs and UI.
- No manual activity entry, no Perso sync, no historical backfill job in v1.

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/types/contact-activities.ts` | Activity types + ContactActivity shape |
| `src/lib/contacts/normalize-email.ts` | Shared email normalize (or re-export prospect normalize) |
| `src/lib/contacts/activities-store.ts` | record + list by email |
| `src/lib/contacts/build-timeline.ts` | Derive + merge + dedupe |
| `src/lib/contacts/contact-stats.ts` | KPIs for one email |
| `src/lib/contacts/*.test.ts` | Unit tests |
| `src/lib/firebase/admin.ts` | Add `contactActivities` collection |
| `src/app/api/admin/contacts/by-email/route.ts` | GET fiche payload |
| Writers in register / cold / prospects bulk / invite / RSVP / participation PATCH | `recordContactActivity` |
| `src/components/admin/admin-contact-fiche.tsx` | Shared fiche UI |
| `src/app/admin/contacts/page.tsx` | Route `?email=` |
| `src/components/admin/admin-prospects.tsx` | Link to fiche |
| `src/components/admin/admin-registrants.tsx` | Link to fiche |
| `docs/prospects-crm.md` | Pointer to contact memory |

---

### Task 1: Types + collection + record/list store

**Files:**
- Create: `src/lib/types/contact-activities.ts`
- Create: `src/lib/contacts/activities-store.ts`
- Modify: `src/lib/firebase/admin.ts`
- Test: `src/lib/contacts/activities-store.test.ts` (pure helpers if any; store may stay untested without emulator)

- [ ] **Step 1:** Add `ContactActivityType` union + `ContactActivity` / `ContactActivityInput` types per spec.
- [ ] **Step 2:** Add `COLLECTIONS.contactActivities = "la_mesa_contact_activities"`.
- [ ] **Step 3:** Implement `recordContactActivity(input)` (soft errors logged) and `listActivitiesByEmail(email, limit)`.
- [ ] **Step 4:** Commit (if user requested commits).

### Task 2: Timeline merge + stats (TDD)

**Files:**
- Create: `src/lib/contacts/build-timeline.ts`
- Create: `src/lib/contacts/contact-stats.ts`
- Test: `src/lib/contacts/build-timeline.test.ts`
- Test: `src/lib/contacts/contact-stats.test.ts`

- [ ] **Step 1:** Write failing tests for dedupe (written wins over derived same type+event+day) and sort desc.
- [ ] **Step 2:** Implement `buildContactTimeline({ activities, waitlist, prospect, participations, events })`.
- [ ] **Step 3:** Write failing tests for invitations / confirmed / declined / revenue for one email.
- [ ] **Step 4:** Implement `buildContactStats(...)` reusing engagement helpers where possible.
- [ ] **Step 5:** `npx vitest run src/lib/contacts/` — all pass.

### Task 3: GET API by-email

**Files:**
- Create: `src/app/api/admin/contacts/by-email/route.ts`

- [ ] **Step 1:** Admin auth + load prospect, waitlist, activities, participations for email, events needed for titles/prices.
- [ ] **Step 2:** Return `{ ok, email, prospect, waitlist, stats, timeline, events }`.
- [ ] **Step 3:** Smoke via tsc.

### Task 4: Wire writers (soft-fail)

**Files:**
- Modify: register (+ light), cold-outreach, prospects bulk/create, invitees / send-invitations / participation invite, RSVP, participation PATCH

- [ ] **Step 1:** After successful primary write, call `recordContactActivity` with correct type/refs/summary.
- [ ] **Step 2:** Ensure failures in record do not change HTTP success of primary route.

### Task 5: Fiche UI + entries

**Files:**
- Create: `src/components/admin/admin-contact-fiche.tsx`
- Create: `src/app/admin/contacts/page.tsx`
- Modify: `admin-shell.tsx` (optional nav), `admin-prospects.tsx`, `admin-registrants.tsx`
- Modify: `docs/prospects-crm.md`

- [ ] **Step 1:** Page `/admin/contacts?email=` loads API and renders KPIs + event list + timeline.
- [ ] **Step 2:** Prospects: link “Mémoire” / open fiche for row email.
- [ ] **Step 3:** Registrants: same link per member email.
- [ ] **Step 4:** Update docs pointer.

### Task 6: Verify

- [ ] **Step 1:** `npx tsc --noEmit` + `npx vitest run src/lib/contacts/`
- [ ] **Step 2:** Manual checklist: open fiche from Prospects and Membres for same email → same KPIs; send cold or RSVP → new activity appears.

---

## Out of plan

Manual WhatsApp notes, CA hors dîner, backfill job, Perso sync.
