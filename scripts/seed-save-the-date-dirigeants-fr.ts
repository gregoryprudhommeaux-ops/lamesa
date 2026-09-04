/**
 * Seed / upsert the Save the Date event for French founders (24 Sept 2026).
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/seed-save-the-date-dirigeants-fr.ts
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!PROJECT_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error("Missing FIREBASE_* env");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: PROJECT_ID,
      clientEmail: CLIENT_EMAIL,
      privateKey: PRIVATE_KEY,
    }),
  });
}

const dbId = process.env.FIREBASE_FIRESTORE_DATABASE_ID?.trim() || "(default)";
const db = dbId === "(default)" ? getFirestore() : getFirestore(dbId);

const SLUG = "dirigeants-fr-2026-09-24";
const LIST_YES = `STD ${SLUG} — OUI`;
const LIST_NO = `STD ${SLUG} — NON/AUTRE`;

/** Wed 24 Sep 2026 20:00 America/Mexico_City ≈ 02:00 UTC next day */
const STARTS_AT = "2026-09-25T02:00:00.000Z";
const ENDS_AT = "2026-09-25T05:00:00.000Z";
/** Sun 6 Sep 2026 23:59 Mexico City ≈ 2026-09-07T05:59:00Z */
const INTEREST_DEADLINE = "2026-09-07T05:59:00.000Z";

async function ensureList(name: string, now: string) {
  const snap = await db.collection("la_mesa_prospect_lists").where("name", "==", name).limit(1).get();
  if (!snap.empty) {
    console.log("list exists", name);
    return;
  }
  const all = await db.collection("la_mesa_prospect_lists").limit(200).get();
  const hit = all.docs.find(
    (d) => String(d.data().name ?? "").toLowerCase() === name.toLowerCase(),
  );
  if (hit) {
    console.log("list exists", hit.data().name);
    return;
  }
  await db.collection("la_mesa_prospect_lists").add({ name, createdAt: now, updatedAt: now });
  console.log("list created", name);
}

async function main() {
  const now = new Date().toISOString();
  const existing = await db.collection("events").where("slug", "==", SLUG).limit(1).get();

  const payload = {
    title: "LA MESA DES DIRIGEANTS ET ENTREPRENEURS FRANÇAIS",
    subtitle: "",
    organizerName: "LA MESA",
    introText:
      "Un dîner entre dirigeants et entrepreneurs français de Guadalajara, autour d’une table assez petite pour que la conversation tienne. On parle de ce qu’on construit ici — business, équipe, décisions — et on se rend utiles les uns aux autres.\n\nLa soirée du <bold>24 septembre</bold> se compose selon qui répond. Fondateurs, dirigeants, entrepreneurs établis : des gens qui portent déjà une vraie responsabilité. On ne publie pas la liste des noms à l’avance ; le filtre, c’est le profil et l’intention.\n\nC’est un <bold>Save the Date</bold>. Tu indiques ton intérêt, on calibre le lieu au centre avec le nombre de réponses, puis on te confirme.\n\n<bold>Invitation nominative.</bold> Merci de répondre avant <bold>dimanche 6 septembre</bold>.",
    venueName: "",
    address: "Centre de Guadalajara — lieu à confirmer",
    city: "Guadalajara",
    startsAt: STARTS_AT,
    endsAt: ENDS_AT,
    capacity: 14,
    priceMxn: null,
    menuPriceMinMxn: null,
    menuPriceMaxMxn: null,
    allInPriceMinMxn: 800,
    allInPriceMaxMxn: 1000,
    responseMode: "interest",
    interestDeadlineAt: INTEREST_DEADLINE,
    mesaNumber: 1,
    format: "dinner",
    eventLanguage: "fr",
    status: "published",
    shareEnabled: true,
    dressCode: "smart_casual",
    parking: "unknown",
    updatedAt: now,
  };

  if (!existing.empty) {
    const ref = existing.docs[0]!.ref;
    await ref.set(payload, { merge: true });
    console.log("updated", ref.id, SLUG);
  } else {
    const ref = await db.collection("events").add({
      ...payload,
      createdAt: now,
      createdByUid: "seed-script",
    });
    console.log("created", ref.id, SLUG);
  }

  await ensureList(LIST_YES, now);
  await ensureList(LIST_NO, now);

  console.log("public url path: /fr/e/" + SLUG);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
