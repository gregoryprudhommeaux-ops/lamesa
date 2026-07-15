# Database Perso — upsert contact (server-to-server)

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
  "notes": "string"
}
```

Response: `{ "ok": true, "id": "contactId", "action": "created" | "merged", "matchedBy"?: "email" | "phone" }`

Match: same email or phone under `DATABASE_PERSO_OWNER_UID`.
Merge: fill empty fields, union emails/phones/keywords, keep existing values when both sides are filled.
Create: new contact with `source: "la-mesa"` and tags including `la-mesa`.

LA MESA calls this on:
- full registration (`POST /api/register`)
- express registration (`POST /api/register/light`)
- profile completion (`PATCH /api/me/profile`)
