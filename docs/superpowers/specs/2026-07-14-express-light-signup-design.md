# Express signup `/light` — design

Date: 2026-07-14

## Goal

Short signup funnel at `lamesasecreta.com/light` collecting **full name, WhatsApp, email**. After submit, the person receives an email to access their account and complete the profile later.

## Decisions

| Topic | Choice |
|-------|--------|
| URL | `/{locale}/light` + bare `/light` → middleware redirect to default locale (`es`) |
| Form fields | `fullName`, WhatsApp (`phone`), `email` |
| Full registration | Unchanged at `/inscription` |
| Auth after signup | Same email via **Google** and/or **email + password** (password created on `/connexion`, not on `/light`) |
| Email CTA | Link to `/{locale}/connexion` with copy explaining both auth options |
| Storage | Waitlist doc with `source: "la-mesa-express"`, `profileComplete: false`, empty placeholders for other fields |

## Flow

1. Guest opens `/es/light` (or `/light` → redirect).
2. Submits express form → `POST /api/register/light`.
3. Firestore waitlist row created; confirmation email (variant `express`) + admin notify.
4. Guest signs in on `/connexion` (Google or create password for that email).
5. Redirected to `/compte?tab=profil` to complete remaining fields.
6. Profile PATCH may set `profileComplete: true` when substantive fields are saved.

## Out of scope

- Magic-link / passwordless email
- Password field on `/light`
- Replacing `/inscription`
