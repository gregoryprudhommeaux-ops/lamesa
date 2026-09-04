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
/** Mon 7 Sep 2026 23:59 Mexico City ≈ 2026-09-08T05:59:00Z */
const INTEREST_DEADLINE = "2026-09-08T05:59:00.000Z";

const INTRO_TEXT = [
  "Je souhaitais t'inviter à participer à un dîner entre dirigeants et entrepreneurs français de Guadalajara, autour d’une table assez petite pour que la conversation soit possible et intéressante pour toi car je m'occupe de la sélection des invités.",
  "",
  "On parlera de ce qu’on construit ici — business, équipe, décisions, partenariats, stratégies — et on se rend utiles les uns aux autres.",
  "",
  "La soirée du <bold>24 septembre</bold> (à partir de 20 h) se composera en fonction des réponses des fondateurs, dirigeants, entrepreneurs établis : des gens qui portent déjà une vraie responsabilité.",
  "",
  "Ce <bold>Save the Date</bold> va nous aider à calibrer le restaurant, et selon ta réponse, tu recevras très prochainement une invitation formelle avec les détails, ainsi que les modalités de règlement à compléter par transfert avant la rencontre.",
  "",
  "<bold>Invitation nominative.</bold> Merci de répondre avant <bold>Lundi 7 Septembre</bold>.",
  "",
  "Pour valider ta réponse, tu vas enregistrer ton profil sur LA MESA (si tu ne l'as pas déjà fait), ce qui te permettra par la suite d'être invité à d'autres rencontres autour de thématiques professionnelles ou autre, tu pourras ensuite choisir celles auxquelles tu souhaites participer ou pas.",
].join("\n");

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
    introText: INTRO_TEXT,
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
