# Internal prospects CRM (admin)

Collection: `la_mesa_prospects`. Lists registry: `la_mesa_prospect_lists`. UI: `/admin/prospects` (layout type Database Perso).

**Mémoire contact unifiée** (prospect + membre, clé email) : `/admin/contacts?email=` — spec `docs/superpowers/specs/2026-08-10-unified-contact-memory-design.md`. Journal : `la_mesa_contact_activities`.

Cold send: Templates → Cold Mail (batch 50, status `to_contact` → `contacted`).

## Layout Perso

- Sidebar **Vos listes** (+ créer, filtrer, renommer, supprimer).
- Table contacts avec sélection multi.
- **Bandeau jaune** flottant en bas dès qu’il y a une sélection.

## Listes

Membership = `prospect.lists[]` (noms). API `/api/admin/prospects/lists`.

Email required. Import Sheet public. Pas de bridge live Perso pour cold.
