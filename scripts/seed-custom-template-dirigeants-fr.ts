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
      "Répondre ici :",
      EVENT_URL_FR,
      "",
      "Pour valider ta réponse, tu vas enregistrer ton profil sur LA MESA (si tu ne l'as pas déjà fait), ce qui te permettra par la suite d'être invité à d'autres rencontres autour de thématiques professionnelles ou autre, tu pourras ensuite choisir celles auxquelles tu souhaites participer ou pas.",
      "",
      "À bientôt,",
      "Greg | LA MESA",
      "",
      "greg@nextstep-services.com",
      "Tel : +52 33 1894 8818",
    ].join("\n"),
  },
  es: {
    subject: "LA MESA · Save the Date — 24 sep. · dirigentes y emprendedores franceses (GDL)",
    body: [
      "Hola {{fullName}},",
      "",
      "Quería invitarte a una cena entre dirigentes y emprendedores franceses en Guadalajara, alrededor de una mesa lo bastante chica para que la conversación sea posible e interesante para ti, porque yo me ocupo de la selección de invitados.",
      "",
      "Hablaremos de lo que construimos aquí — negocio, equipo, decisiones, alianzas, estrategias — y nos haremos útiles entre nosotros.",
      "",
      "La noche del <bold>24 de septiembre</bold> (desde las 20 h) se armará según las respuestas de fundadores, dirigentes y emprendedores establecidos: gente que ya carga una responsabilidad real.",
      "",
      "Este <bold>Save the Date</bold> nos ayuda a calibrar el restaurante y, según tu respuesta, recibirás muy pronto una invitación formal con los detalles y las modalidades de pago por transferencia antes del encuentro.",
      "",
      "<bold>Invitación nominativa.</bold> Responde antes del <bold>lunes 7 de septiembre</bold>.",
      "",
      "Responder aquí:",
      EVENT_URL_ES,
      "",
      "Para validar tu respuesta, registrarás tu perfil en LA MESA (si aún no lo has hecho), lo que luego te permitirá ser invitado(a) a otros encuentros sobre temas profesionales u otros; después podrás elegir en cuáles participar o no.",
      "",
      "Saludos,",
      "Greg | LA MESA",
      "",
      "greg@nextstep-services.com",
      "Tel : +52 33 1894 8818",
    ].join("\n"),
  },
  en: {
    subject: "LA MESA · Save the Date — 24 Sep · French directors & entrepreneurs (GDL)",
    body: [
      "Hi {{fullName}},",
      "",
      "I wanted to invite you to a dinner for French directors and entrepreneurs in Guadalajara, around a table small enough for a real conversation that stays interesting for you — I curate the guest list myself.",
      "",
      "We will talk about what we are building here — business, team, decisions, partnerships, strategy — and try to be useful to each other.",
      "",
      "The evening of <bold>24 September</bold> (from 8 pm) will take shape based on replies from founders, directors, and established entrepreneurs: people already carrying real responsibility.",
      "",
      "This <bold>Save the Date</bold> helps us size the restaurant, and based on your reply you will soon get a formal invitation with details and payment instructions by bank transfer before the dinner.",
      "",
      "<bold>Nominative invite.</bold> Please reply by <bold>Monday 7 September</bold>.",
      "",
      "Reply here:",
      EVENT_URL_EN,
      "",
      "To confirm your reply, you will register your LA MESA profile (if you have not already), which later lets you be invited to other gatherings around professional themes or otherwise — you can then choose which ones to join.",
      "",
      "Best,",
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
