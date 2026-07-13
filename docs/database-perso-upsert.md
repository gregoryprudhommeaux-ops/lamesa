# Database Perso — endpoint upsert (à ajouter côté database-perso)

POST `/api/public/contacts/upsert`

Headers: `Authorization: Bearer {DATABASE_PERSO_API_TOKEN}`

Body:
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

Response: `{ "ok": true, "id": "contactId" }`

En attendant cet endpoint, les inscriptions sont stockées dans Firestore `la_mesa_waitlist`.
