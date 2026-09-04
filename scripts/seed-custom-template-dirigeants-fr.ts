/**
 * Seed / upsert custom email template for the dirigeants FR Save the Date page.
 * Editable in Admin → Templates → Custom, usable from Prospects cold email.
 *
 *   node --env-file=.env.local --import tsx scripts/seed-custom-template-dirigeants-fr.ts
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

const KEY = "custom_dirigeants_fr_2026_09_24";
const LABEL = "STD dirigeants FR — 24 sept. 2026";
const EVENT_URL_FR = "https://lamesasecreta.com/fr/e/dirigeants-fr-2026-09-24";
const EVENT_URL_ES = "https://lamesasecreta.com/es/e/dirigeants-fr-2026-09-24";
const EVENT_URL_EN = "https://lamesasecreta.com/en/e/dirigeants-fr-2026-09-24";

const locales = {
  fr: {
    subject: "LA MESA · Save the Date — 24 sept. · dirigeants & entrepreneurs français (GDL)",
    body: [
      "Bonjour {{fullName}},",
      "",
      "Un dîner entre dirigeants et entrepreneurs français de Guadalajara, autour d’une table assez petite pour que la conversation tienne. On parle de ce qu’on construit ici — business, équipe, décisions — et on se rend utiles les uns aux autres.",
      "",
      "La soirée du <bold>24 septembre</bold> (à partir de 20 h) se compose selon qui répond. Fondateurs, dirigeants, entrepreneurs établis : des gens qui portent déjà une vraie responsabilité. On ne publie pas la liste des noms à l’avance ; le filtre, c’est le profil et l’intention.",
      "",
      "C’est un <bold>Save the Date</bold>. Tu indiques ton intérêt, on calibre le lieu au centre avec le nombre de réponses, puis on te confirme. Selon ta réponse, tu recevras une invitation formelle avec les détails, ainsi que les modalités de règlement à compléter par transfert avant la rencontre.",
      "",
      "<bold>Invitation nominative.</bold> Merci de répondre avant <bold>dimanche 6 septembre</bold>.",
      "",
      "Répondre ici :",
      EVENT_URL_FR,
      "",
      "Pour toute question : greg@nextstep-services.com",
      "",
      "À bientôt,",
      "Greg | LA MESA",
    ].join("\n"),
  },
  es: {
    subject: "LA MESA · Save the Date — 24 sep. · dirigentes y emprendedores franceses (GDL)",
    body: [
      "Hola {{fullName}},",
      "",
      "Una cena entre dirigentes y emprendedores franceses en Guadalajara, alrededor de una mesa lo bastante chica para que la conversación se sostenga. Hablamos de lo que construimos aquí — negocio, equipo, decisiones — y nos hacemos útiles entre nosotros.",
      "",
      "La noche del <bold>24 de septiembre</bold> (desde las 20 h) se arma según quién responde. Fundadores, dirigentes, emprendedores establecidos: gente que ya carga una responsabilidad real. No publicamos la lista de nombres de antemano; el filtro es el perfil y la intención.",
      "",
      "Es un <bold>Save the Date</bold>. Indicas tu interés, calibramos el lugar en el centro con el número de respuestas, y luego confirmamos. Según tu respuesta, recibirás una invitación formal con los detalles y las modalidades de pago por transferencia antes del encuentro.",
      "",
      "<bold>Invitación nominativa.</bold> Responde antes del <bold>domingo 6 de septiembre</bold>.",
      "",
      "Responder aquí:",
      EVENT_URL_ES,
      "",
      "Dudas: greg@nextstep-services.com",
      "",
      "Saludos,",
      "Greg | LA MESA",
    ].join("\n"),
  },
  en: {
    subject: "LA MESA · Save the Date — 24 Sep · French directors & entrepreneurs (GDL)",
    body: [
      "Hi {{fullName}},",
      "",
      "A dinner for French directors and entrepreneurs in Guadalajara, around a table small enough for a real conversation. We talk about what we are building here — business, team, decisions — and we try to be useful to each other.",
      "",
      "The evening of <bold>24 September</bold> (from 8 pm) is shaped by who replies. Founders, directors, established entrepreneurs: people already carrying real responsibility. We do not publish the guest list in advance; the filter is profile and intent.",
      "",
      "This is a <bold>Save the Date</bold>. You share your interest, we size the downtown venue to the replies, then we confirm. Based on your reply, you will get a formal invitation with details and payment instructions by bank transfer before the dinner.",
      "",
      "<bold>Nominative invite.</bold> Please reply by <bold>Sunday 6 September</bold>.",
      "",
      "Reply here:",
      EVENT_URL_EN,
      "",
      "Questions: greg@nextstep-services.com",
      "",
      "Best,",
      "Greg | LA MESA",
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
    },
    { merge: true },
  );

  console.log(existing.exists ? "updated" : "created", KEY);
  console.log("Admin → Templates → Custom →", LABEL);
  console.log("Prospects cold email can pick this template (FR/ES/EN).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
