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
      "Je souhaitais t'inviter à participer à <bold>un dîner entre dirigeants et entrepreneurs français de Guadalajara</bold>, autour d’une table assez petite pour que la conversation soit possible, mais qu'elle soit aussi intéressante pour toi, car je m'occupe de la sélection des invités parmi des fondateurs, dirigeants, entrepreneurs établis : des gens qui portent déjà une vraie responsabilité.",
      "",
      "On parlera de ce qu’on construit ici — business, équipe, décisions, partenariats, stratégies — et on se rend utiles les uns aux autres.",
      "",
      "Ce dîner aura lieu le <bold>24 septembre</bold> (à partir de 20 h).",
      "",
      "Ce <bold>Save the Date</bold> va nous aider à calibrer le restaurant, et selon ta réponse, tu recevras très prochainement une invitation formelle avec les détails, ainsi que les modalités de règlement à compléter par transfert avant la rencontre, et si finalement tu changes d'avis que le budget ne te convient pas, ou que tu as un empêchement, aucun problème, on te retrouvera une prochaine fois!",
      "",
      "<bold>Invitation nominative.</bold>",
      `Merci de répondre avant <bold>Lundi 14 Septembre</bold> en visitant cette page : <a href="${EVENT_URL_FR}">DONNER MA RÉPONSE</a>.`,
      "",
      "<i>Si tu ne l'as pas déjà fait, il va te falloir t'enregistrer sur LA MESA SECRETA, ceci te permettra d'être invité à d'autres rencontres autour de thématiques professionnelles selon ton profil.</i>",
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
      "Quería invitarte a participar en <bold>una cena entre dirigentes y emprendedores franceses de Guadalajara</bold>, alrededor de una mesa lo bastante chica para que la conversación sea posible, y también interesante para ti, porque yo me ocupo de la selección de invitados entre fundadores, dirigentes y emprendedores establecidos: gente que ya carga una responsabilidad real.",
      "",
      "Hablaremos de lo que construimos aquí — negocio, equipo, decisiones, alianzas, estrategias — y nos haremos útiles entre nosotros.",
      "",
      "Esta cena será el <bold>24 de septiembre</bold> (desde las 20 h).",
      "",
      "Este <bold>Save the Date</bold> nos ayuda a calibrar el restaurante y, según tu respuesta, recibirás muy pronto una invitación formal con los detalles y las modalidades de pago por transferencia antes del encuentro; y si al final cambias de opinión, el presupuesto no te conviene o tienes un imprevisto, ningún problema: te vemos en otra ocasión.",
      "",
      "<bold>Invitación nominativa.</bold>",
      `Responde antes del <bold>lunes 14 de septiembre</bold> en esta página: <a href="${EVENT_URL_ES}">DAR MI RESPUESTA</a>.`,
      "",
      "<i>Si aún no lo has hecho, tendrás que registrarte en LA MESA SECRETA; esto te permitirá ser invitado(a) a otros encuentros sobre temas profesionales según tu perfil.</i>",
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
      "I wanted to invite you to <bold>a dinner for French directors and entrepreneurs in Guadalajara</bold>, around a table small enough for a real conversation that stays interesting for you — I curate the guest list among founders, directors, and established entrepreneurs: people already carrying real responsibility.",
      "",
      "We will talk about what we are building here — business, team, decisions, partnerships, strategy — and try to be useful to each other.",
      "",
      "This dinner is on <bold>24 September</bold> (from 8 pm).",
      "",
      "This <bold>Save the Date</bold> helps us size the restaurant, and based on your reply you will soon get a formal invitation with details and payment by bank transfer before the dinner — and if you change your mind, the budget does not work, or something comes up, no problem: we will see you another time.",
      "",
      "<bold>Nominative invite.</bold>",
      `Please reply by <bold>Monday 14 September</bold> on this page: <a href="${EVENT_URL_EN}">GIVE MY REPLY</a>.`,
      "",
      "<i>If you have not already, you will need to register on LA MESA SECRETA; that lets you be invited to other gatherings around professional themes based on your profile.</i>",
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
