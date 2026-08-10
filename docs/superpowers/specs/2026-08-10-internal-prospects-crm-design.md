# Internal Prospects CRM (LA MESA)

## Goal

Admin-only CRM for cold outreach inside LA MESA. No live Database Perso bridge.
Source of contacts: Google Sheet / CSV paste / manual add. Email required.

## Collection

`la_mesa_prospects`

## Prospect fields

- `email` (required, unique key when normalized)
- `fullName`, `company`, `position`, `sector`, `city`, `linkedin`, `phone`, `notes`
- `tags: string[]`
- `status`: `to_contact` | `contacted` | `nurture` | `won` | `do_not_contact`
- `source`, `createdAt`, `updatedAt`, `lastContactedAt?`
- Soft delete: `deletedAt?`

## Rules

- No email → reject (not stored).
- Import merges on normalized email (fill empty fields; never duplicate).
- Manual merge: pick two ids → one survivor.
- No LinkedIn profile scanning in MVP.

## UI (option C)

- `/admin/prospects` — list, fiche, import Sheet, add, merge.
- Cold Mail panel — select `to_contact`, send batches of 50 → mark `contacted`.

## Out of scope (later)

- Automated relances, table matching recommendations, Perso sync.
