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
  "laMesaRegistered": true
}
```

Response: `{ "ok": true, "id": "contactId", "action": "created" | "merged", "matchedBy"?: "email" | "phone", "lists"?: { ... } }`

Match: same email or phone under `DATABASE_PERSO_OWNER_UID`.  
Merge: fill empty fields, union emails/phones/keywords, keep existing values when both sides are filled.  
Create: new contact with `source: "la-mesa"` and keywords including `la-mesa`.

With `laMesaRegistered: true`:
1. Upsert the contact
2. Add to playlist **LA MESA - INSCRITS**
3. Remove from playlist **LA MESA - CONTACTER**

LA MESA calls this on:
- full registration (`POST /api/register`)
- express registration (`POST /api/register/light`)
- profile completion (`PATCH /api/me/profile`)

## List bridge (cold outreach)

| Liste Perso | Rôle |
|-------------|------|
| `LA MESA - INSCRITS` | Sync auto à l’inscription |
| `LA MESA - CONTACTER` | Remplie à la main ; actions **A CONTACTER** / **CONTACTÉ** |

| Endpoint | Usage |
|----------|--------|
| `POST /api/public/lists/la-mesa/ensure` | Crée les 2 listes + actions |
| `GET /api/public/lists/la-mesa/to-contact` | Prospects à cold-mailer |
| `POST /api/public/lists/la-mesa/mark-contacted` | Body `{ contactIds: [] }` après envoi |
| `POST /api/public/lists/la-mesa/on-registered` | Body `{ contactId }` (aussi via upsert) |

Helpers côté LA MESA : `ensureLaMesaLists`, `listLaMesaToContact`, `markLaMesaContacted` dans `src/lib/database-perso.ts`.

### Ops manuelles (Perso UI)

1. `POST …/ensure` une fois (ou laisse l’inscription créer les listes)
2. Ajoute des prospects à **LA MESA - CONTACTER**
3. Coche **A CONTACTER** sur ceux à mailer
4. Depuis LA MESA (prochaine étape UI) : envoi Cold Mail → `mark-contacted`
5. S’ils s’inscrivent → auto **INSCRITS**, hors **CONTACTER**
