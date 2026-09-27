# Database Perso — upsert + listes LA MESA

## Upsert contact

POST `/api/public/contacts/upsert`

Headers: `Authorization: Bearer {DATABASE_PERSO_API_TOKEN}`

Body (LA MESA):
```json
{
  "fullName": "string",
  "linkedinUrl": "string",
  "emails": ["string"],
  "phones": ["string"],
  "company": "string",
  "sector": "string",
  "position": "string",
  "keywords": ["string"],
  "extraActivities": ["string"],
  "city": "string",
  "tags": ["la-mesa", "waitlist", "guadalajara"],
  "source": "la-mesa-registration",
  "locale": "fr",
  "notes": "string",
  "laMesaRegistered": true,
  "mergePolicy": "prefer_incoming",
  "notesMode": "append",
  "sourceUpdatedAt": "2026-09-27T15:00:00.000Z"
}
```

Response: `{ "ok": true, "id": "contactId", "action": "created" | "merged", "matchedBy"?: "email" | "phone", "lists"?: { ... } }`

Match: same email or phone under `DATABASE_PERSO_OWNER_UID`.

### Merge policy (newest wins)

| `mergePolicy` | Behaviour |
|---------------|-----------|
| `fill_empty` (legacy default on Perso) | Fill blank Perso fields only; keep existing when both sides filled |
| `prefer_incoming` (**LA MESA default**) | Non-empty LA MESA fields overwrite Perso values |

`notesMode: "append"` — LA MESA note block is appended (does not wipe LinkedIn-scan notes on Perso).  
`sourceUpdatedAt` — ISO stamp of the LA MESA profile write that triggered the upsert.

LA MESA also sanitizes phones (strips `(Whatsapp only)` etc.) and normalizes LinkedIn URLs before upsert.

With `laMesaRegistered: true`:
1. Upsert the contact
2. Add to playlist **LA MESA - INSCRITS**
3. Remove from playlist **LA MESA - CONTACTER**

LA MESA calls this on:
- full registration (`POST /api/register`)
- express registration (`POST /api/register/light`)
- profile completion (`PATCH /api/me/profile`)
- admin resync (`POST /api/admin/waitlist/[id]/sync-perso`) — **bidirectional**
- bulk failed resync (`POST /api/admin/waitlist/resync-perso-failed`)

## Pull enrichment (Perso → LA MESA)

Admin resync / bulk failed:

1. `GET /api/public/contacts/search?q={email}` → match contact by email
2. Fill empty LA MESA fields from Perso (LinkedIn, company, sector, position, city, phone, activities)
3. If Perso `updatedAt` is newer than LA MESA `updatedAt`, Perso non-empty values win
4. Append Perso notes under `[Perso]` into `opsNotes` (once)
5. Push LA MESA → Perso with `mergePolicy: prefer_incoming`

## List bridge (cold outreach)

| Liste Perso | Rôle |
|-------------|------|
| `LA MESA - INSCRITS` | Sync auto à l’inscription |
| `LA MESA - CONTACTER` | Remplie à la main ; actions **A CONTACTER** / **CONTACTÉ** |

| Endpoint | Usage |
|----------|--------|
| `POST /api/public/lists/la-mesa/ensure` | Crée les 2 listes + actions |
| `GET /api/public/lists/la-mesa/to-contact` | Prospects à cold-mailer |
| `POST /api/public/lists/la-mesa/mark-contacted` | Body `{ contactIds: [] }` after send |
| `POST /api/public/lists/la-mesa/on-registered` | Body `{ contactId }` (aussi via upsert) |

Helpers côté LA MESA : `ensureLaMesaLists`, `listLaMesaToContact`, `markLaMesaContacted`, `addLaMesaToContacter`, `findContactByEmail` dans `src/lib/database-perso.ts`.

Admin UI : Personnes → **Resync Perso failed** (bulk) / fiche membre → **Resync Perso ↔**

### Ops manuelles (Perso UI)

1. `POST …/ensure` une fois (ou laisse l’inscription créer les listes)
2. Ajoute des prospects à **LA MESA - CONTACTER**
3. Coche **A CONTACTER** sur ceux à mailer
4. Depuis LA MESA : envoi Cold Mail → `mark-contacted`
5. S’ils s’inscrivent → auto **INSCRITS**, hors **CONTACTER**
