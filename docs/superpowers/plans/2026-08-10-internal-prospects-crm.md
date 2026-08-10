# Internal Prospects CRM Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Perso-backed cold outreach with Firestore `la_mesa_prospects` + admin CRM page + batch send 50.

**Architecture:** Types/lib → Admin REST API → Prospects page + rewired ColdOutreachPanel.

**Tech:** Next.js App Router, Firestore Admin, existing `authFetch` / Brevo cold send.

## File map

- `src/lib/types/prospects.ts` — types
- `src/lib/prospects/*` — normalize, upsert, merge, sheet parse, firestore helpers
- `src/app/api/admin/prospects/route.ts` — list/create/import
- `src/app/api/admin/prospects/[id]/route.ts` — get/patch/delete
- `src/app/api/admin/prospects/merge/route.ts` — merge two
- `src/app/admin/prospects/page.tsx` + `admin-prospects.tsx` UI
- Rewire `cold-outreach/route.ts` + `cold-outreach-panel.tsx`
- `COLLECTIONS.prospects` in firebase admin
- Nav link in `admin-shell.tsx`

## Tasks

### Task 1: Types + lib + tests (dedup/upsert/merge/parse)

### Task 2: Admin API prospects

### Task 3: Admin Prospects UI page

### Task 4: Rewire cold outreach to internal CRM (batch 50)

### Task 5: Smoke tests + short docs note
