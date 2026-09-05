/**
 * Seed / upsert custom email: relance prospects encore « À suivre » (STD 24 sept.).
 * Editable in Admin → Templates → Custom, usable from Prospects → Email.
 *
 *   node --env-file=.env.local --import tsx scripts/seed-custom-template-relance-a-suivre.ts
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

const KEY = "custom_relance_a_suivre_std_24_sept";
const LABEL = "Relance À suivre — STD 24 sept.";
const EVENT_URL_FR = "https://lamesasecreta.com/fr/e/dirigeants-fr-2026-09-24";
const EVENT_URL_ES = "https://lamesasecreta.com/es/e/dirigeants-fr-2026-09-24";
const EVENT_URL_EN = "https://lamesasecreta.com/en/e/dirigeants-fr-2026-09-24";

const locales = {
  fr: {
    subject: "LA MESA · On a besoin de ta réponse (24 sept.)",
    body: [
      "Bonjour {{fullName}},",
      "",
      "On n’a toujours pas ta réponse au Save the Date du <bold>24 septembre</bold> — dîner dirigeants & entrepreneurs français à Guadalajara.",
      "",
      "Oui, non, ou indisponible ce jour-là : on a besoin d’un retour. Un non n’est pas un problème. Ce qui bloque, c’est le silence.",
      "",
      "Sans profil enregistré dans LA MESA, on ne peut pas te considérer pour une thématique qui pourrait te coller plus tard. Le matching part de ton expérience, ton poste, ton industrie, tes spécialités et tes intérêts — pas d’une liste générique.",
      "",
      `2 minutes ici : <a href="${EVENT_URL_FR}">DONNER MA RÉPONSE</a>`,
      "",
      "Merci,",
      "Greg | LA MESA",
      "",
      "greg@nextstep-services.com",
      "Tel : +52 33 1894 8818",
    ].join("\n"),
  },
  es: {
    subject: "LA MESA · Necesitamos tu respuesta (24 sep.)",
    body: [
      "Hola {{fullName}},",
      "",
      "Todavía no tenemos tu respuesta al Save the Date del <bold>24 de septiembre</bold> — cena de dirigentes y emprendedores franceses en Guadalajara.",
      "",
      "Sí, no, o no disponible ese día: necesitamos un retorno. Un no no es un problema. Lo que bloquea es el silencio.",
      "",
      "Sin perfil registrado en LA MESA, no podemos considerarte para una temática que podría encajarte más adelante. El matching parte de tu experiencia, tu puesto, tu industria, tus especialidades y tus intereses — no de una lista genérica.",
      "",
      `2 minutos aquí: <a href="${EVENT_URL_ES}">DAR MI RESPUESTA</a>`,
      "",
      "Gracias,",
      "Greg | LA MESA",
      "",
      "greg@nextstep-services.com",
      "Tel : +52 33 1894 8818",
    ].join("\n"),
  },
  en: {
    subject: "LA MESA · We need your reply (24 Sep)",
    body: [
      "Hi {{fullName}},",
      "",
      "We still don’t have your reply to the Save the Date for <bold>24 September</bold> — dinner for French directors & entrepreneurs in Guadalajara.",
      "",
      "Yes, no, or unavailable that day: we need an answer. A no is fine. What blocks us is silence.",
      "",
      "Without a registered LA MESA profile, we can’t consider you for a theme that might fit you later. Matching starts from your experience, role, industry, specialties, and interests — not a generic list.",
      "",
      `2 minutes here: <a href="${EVENT_URL_EN}">GIVE MY REPLY</a>`,
      "",
      "Thanks,",
      "Greg | LA MESA",
      "",
      "greg@nextstep-services.com",
      "Tel : +52 33 1894 8818",
    ].join("\n"),
  },
};

async function main() {
  const now = new Date().toISOString();
  const ref = db.collection("email_templates").doc(KEY);
  const existing = await ref.get();

  await ref.set(
    {
      key: KEY,
      custom: true,
      label: LABEL,
      locales,
      enabled: true,
      updatedAt: now,
      ...(existing.exists ? {} : { createdAt: now }),
      sourceEventSlug: "dirigeants-fr-2026-09-24",
      sourceEventUrl: EVENT_URL_FR,
      notes: "Relance jeudi 10 sept. 2026 · 8h Guadalajara · prospects statut À suivre",
    },
    { merge: true },
  );

  console.log(existing.exists ? "updated" : "created", KEY);
  console.log("Admin → Templates → Custom →", LABEL);
  console.log("Prospects → filtre À suivre → Email → ce template (FR).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
