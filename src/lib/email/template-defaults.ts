import type { EmailTemplateDoc, EmailTemplateKey, TemplateLocale } from "@/lib/types/events";
import {
  cancellationPolicyBlock,
  paymentBankBlock,
  paymentDeadlineBlock,
} from "@/lib/events/payment-details";

export const SYSTEM_EMAIL_TEMPLATE_KEYS = [
  "calendar_invite",
  "participation_confirmed",
  "reminder_7d",
  "reminder_36h",
  "reminder_90m",
  "satisfaction_survey",
  "light_signup",
  "referral_invite",
  "fn_announcement",
  "profile_incomplete",
  "save_the_date",
  "interest_ack",
] as const;

export type SystemEmailTemplateKey = (typeof SYSTEM_EMAIL_TEMPLATE_KEYS)[number];

/** @deprecated Prefer SYSTEM_EMAIL_TEMPLATE_KEYS — kept for existing imports */
export const EMAIL_TEMPLATE_KEYS: EmailTemplateKey[] = [...SYSTEM_EMAIL_TEMPLATE_KEYS];

export const TEMPLATE_LOCALES: TemplateLocale[] = ["es", "fr", "en"];

/** Default language for email + WhatsApp sends when event has no language. */
export const DEFAULT_SEND_LOCALE: TemplateLocale = "es";

export const EMAIL_TEMPLATE_LABELS: Record<SystemEmailTemplateKey, string> = {
  calendar_invite: "Invitation calendrier (ICS + YES/NO)",
  participation_confirmed: "Confirmation après paiement",
  reminder_7d: "Rappel J-7 (legacy email — préférer VALARM ICS)",
  reminder_36h: "Rappel H-36 (legacy email — préférer VALARM ICS)",
  reminder_90m: "Rappel H-1h30 (legacy email — préférer VALARM ICS)",
  satisfaction_survey: "Questionnaire satisfaction (+12h, cron 1×/jour)",
  light_signup: "Inscription express (/light) — compléter le profil",
  referral_invite:
    "Invitation ami (parrainage / satisfaction « Sí, invitar »)",
  fn_announcement:
    "Annonce FrancoNetwork → LA MESA (ES — auto à l’import FN + manuel admin)",
  profile_incomplete:
    "Profil incomplet — rappel mensuel (ES, cron 1er du mois)",
  save_the_date:
    "Save the Date / intérêt (nominatif — OUI/NON/AUTRE sur la page événement)",
  interest_ack:
    "Accusé Save the Date — email auto après validation de la réponse",
};

export const TEMPLATE_LOCALE_LABELS: Record<TemplateLocale, string> = {
  es: "Español",
  fr: "Français",
  en: "English",
};

export function isSystemEmailTemplateKey(key: string): key is SystemEmailTemplateKey {
  return (SYSTEM_EMAIL_TEMPLATE_KEYS as readonly string[]).includes(key);
}

export function isCustomEmailTemplateKey(key: string): key is `custom_${string}` {
  return /^custom_[a-z0-9]+(?:_[a-z0-9]+)*$/.test(key);
}

export function slugToCustomTemplateKey(slug: string): `custom_${string}` | null {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  if (!normalized || normalized.length < 2 || normalized.length > 48) return null;
  const key = `custom_${normalized}` as const;
  return isCustomEmailTemplateKey(key) ? key : null;
}

type LocalePair = { subject: string; body: string };

function customStarterLocales(label: string): Record<TemplateLocale, LocalePair> {
  const title = label.trim() || "LA MESA";
  return {
    es: {
      subject: `LA MESA — ${title}`,
      body: [
        "Hola {{fullName}},",
        "",
        "Escribimos desde LA MESA.",
        "",
        "(Completa aquí el mensaje.)",
        "",
        "Saludos,",
        "LA MESA",
      ].join("\n"),
    },
    fr: {
      subject: `LA MESA — ${title}`,
      body: [
        "Bonjour {{fullName}},",
        "",
        "Un message de LA MESA.",
        "",
        "(Complète ici le message.)",
        "",
        "À bientôt,",
        "LA MESA",
      ].join("\n"),
    },
    en: {
      subject: `LA MESA — ${title}`,
      body: [
        "Hi {{fullName}},",
        "",
        "A note from LA MESA.",
        "",
        "(Add your message here.)",
        "",
        "Best,",
        "LA MESA",
      ].join("\n"),
    },
  };
}

const DEFAULTS: Record<SystemEmailTemplateKey, Record<TemplateLocale, LocalePair>> = {
  calendar_invite: {
    es: {
      subject: "Invitación LA MESA — {{eventTitle}}",
      body: [
        "Estimado/a {{fullName}}:",
        "",
        "Te invitamos a LA MESA ({{format}}): {{eventTitle}}.",
        "",
        "No compartimos la lista de nombres. En la invitación adelantamos la composición (tema, sectores o roles) cuando está disponible.",
        "",
        "Fecha y hora: {{when}}",
        "Lugar: {{where}}",
        "",
        "Ticket ACCESS (confirmación de lugar):",
        "Precio: {{priceBeforeTax}}",
        "IVA (16 %): {{ivaAmount}}",
        "Total: {{totalWithIva}}",
        "Incluye: {{accessIncludes}}",
        "",
        "Menú negociado (pago en el lugar):",
        "{{menuIncluded}}",
        "",
        "El ticket ACCESS confirma tu lugar. El menú negociado y el resto de consumos en el lugar van por tu cuenta (salvo lo marcado en ACCESS).",
        "",
        paymentDeadlineBlock("es"),
        "",
        cancellationPolicyBlock("es"),
        "",
        paymentBankBlock("es"),
        "",
        "Confirma tu asistencia (selecciona YES o NO):",
        "YES: {{yesUrl}}",
        "NO: {{noUrl}}",
        "",
        "Página del evento: {{eventUrl}}",
        "",
        "Adjuntamos un archivo de calendario (.ics) a este correo.",
        "",
        "Quedamos a tus órdenes,",
        "LA MESA",
      ].join("\n"),
    },
    fr: {
      subject: "Invitation LA MESA — {{eventTitle}}",
      body: [
        "Bonjour {{fullName}},",
        "",
        "Tu es invité(e) à LA MESA ({{format}}) : {{eventTitle}}.",
        "",
        "On ne partage pas la liste nominative. L’invitation peut préciser la composition (thème, secteurs ou rôles) quand elle est disponible.",
        "",
        "Quand : {{when}}",
        "Où : {{where}}",
        "",
        "Ticket ACCESS (confirmation de place) :",
        "Prix : {{priceBeforeTax}}",
        "IVA (16%) : {{ivaAmount}}",
        "Total : {{totalWithIva}}",
        "Inclus : {{accessIncludes}}",
        "",
        "Menu négocié (paiement sur place) :",
        "{{menuIncluded}}",
        "",
        "Le ticket ACCESS confirme ta place. Le menu négocié et le reste des consommations sur place sont à ta charge (sauf ce qui est marqué dans ACCESS).",
        "",
        paymentDeadlineBlock("fr"),
        "",
        cancellationPolicyBlock("fr"),
        "",
        paymentBankBlock("fr"),
        "",
        "Confirme ta présence (clique YES ou NO) :",
        "YES : {{yesUrl}}",
        "NO : {{noUrl}}",
        "",
        "Page de l’événement : {{eventUrl}}",
        "",
        "Un fichier calendrier (.ics) est joint à cet email.",
        "",
        "À bientôt,",
        "LA MESA",
      ].join("\n"),
    },
    en: {
      subject: "LA MESA invitation — {{eventTitle}}",
      body: [
        "Hi {{fullName}},",
        "",
        "You’re invited to LA MESA ({{format}}): {{eventTitle}}.",
        "",
        "We don’t share a name list. The invitation may outline the makeup (theme, sectors or roles) when available.",
        "",
        "When: {{when}}",
        "Where: {{where}}",
        "",
        "ACCESS ticket (seat confirmation):",
        "Price: {{priceBeforeTax}}",
        "IVA (16%): {{ivaAmount}}",
        "Total: {{totalWithIva}}",
        "Includes: {{accessIncludes}}",
        "",
        "Negotiated menu (paid on site):",
        "{{menuIncluded}}",
        "",
        "The ACCESS ticket confirms your seat. The negotiated menu and other on-site consumptions are on you (except what is marked under ACCESS).",
        "",
        paymentDeadlineBlock("en"),
        "",
        cancellationPolicyBlock("en"),
        "",
        paymentBankBlock("en"),
        "",
        "Confirm your attendance (tap YES or NO):",
        "YES: {{yesUrl}}",
        "NO: {{noUrl}}",
        "",
        "Event page: {{eventUrl}}",
        "",
        "A calendar file (.ics) is attached to this email.",
        "",
        "See you soon,",
        "LA MESA",
      ].join("\n"),
    },
  },
  participation_confirmed: {
    es: {
      subject: "Participación confirmada — {{eventTitle}}",
      body: [
        "Estimado/a {{fullName}}:",
        "",
        "Confirmamos tu participación en « {{eventTitle}} » ({{format}}).",
        "",
        "Fecha y hora: {{when}}",
        "Lugar: {{where}}",
        "",
        "Recuerda: el ticket ACCESS confirma tu lugar (ver inclusiones en la invitación). El menú negociado y el resto de consumos en el lugar van por tu cuenta.",
        "",
        "Detalles: {{eventUrl}}",
        "",
        cancellationPolicyBlock("es"),
        "",
        "Quedamos a tus órdenes,",
        "LA MESA",
      ].join("\n"),
    },
    fr: {
      subject: "Participation confirmée — {{eventTitle}}",
      body: [
        "Bonjour {{fullName}},",
        "",
        "Ta participation à {{eventTitle}} ({{format}}) est confirmée.",
        "",
        "Quand : {{when}}",
        "Où : {{where}}",
        "",
        "Rappel : le ticket ACCESS confirme ta place (voir inclusions dans l’invitation). Le menu négocié et le reste des consommations sur place sont à ta charge.",
        "",
        "Détails : {{eventUrl}}",
        "",
        cancellationPolicyBlock("fr"),
        "",
        "Au plaisir de te retrouver,",
        "LA MESA",
      ].join("\n"),
    },
    en: {
      subject: "Participation confirmed — {{eventTitle}}",
      body: [
        "Hi {{fullName}},",
        "",
        "Your spot at {{eventTitle}} ({{format}}) is confirmed.",
        "",
        "When: {{when}}",
        "Where: {{where}}",
        "",
        "Reminder: the ACCESS ticket confirms your seat (see inclusions in the invitation). The negotiated menu and other on-site consumptions are on you.",
        "",
        "Details: {{eventUrl}}",
        "",
        cancellationPolicyBlock("en"),
        "",
        "Looking forward to seeing you,",
        "LA MESA",
      ].join("\n"),
    },
  },
  reminder_7d: {
    es: {
      subject: "Recordatorio — {{eventTitle}} (falta 1 semana)",
      body: [
        "Estimado/a {{fullName}}:",
        "",
        "Te recordamos que LA MESA « {{eventTitle}} » ({{format}}) tendrá lugar en una semana.",
        "",
        "Fecha y hora: {{when}}",
        "Lugar: {{where}}",
        "",
        "{{eventUrl}}",
        "",
        "Quedamos a tus órdenes,",
        "LA MESA",
      ].join("\n"),
    },
    fr: {
      subject: "Rappel J-7 — {{eventTitle}}",
      body: [
        "Bonjour {{fullName}},",
        "",
        "Rappel : LA MESA « {{eventTitle}} » ({{format}}) a lieu dans une semaine.",
        "",
        "Quand : {{when}}",
        "Où : {{where}}",
        "",
        "{{eventUrl}}",
        "",
        "LA MESA",
      ].join("\n"),
    },
    en: {
      subject: "Reminder 7 days — {{eventTitle}}",
      body: [
        "Hi {{fullName}},",
        "",
        "Reminder: LA MESA “{{eventTitle}}” ({{format}}) is in one week.",
        "",
        "When: {{when}}",
        "Where: {{where}}",
        "",
        "{{eventUrl}}",
        "",
        "LA MESA",
      ].join("\n"),
    },
  },
  reminder_36h: {
    es: {
      subject: "Recordatorio — {{eventTitle}} (en 36 horas)",
      body: [
        "Estimado/a {{fullName}}:",
        "",
        "LA MESA « {{eventTitle}} » ({{format}}) tendrá lugar en aproximadamente 36 horas.",
        "",
        "Fecha y hora: {{when}}",
        "Lugar: {{where}}",
        "",
        "{{eventUrl}}",
        "",
        "Quedamos a tus órdenes,",
        "LA MESA",
      ].join("\n"),
    },
    fr: {
      subject: "Rappel — {{eventTitle}} dans 36h",
      body: [
        "Bonjour {{fullName}},",
        "",
        "LA MESA « {{eventTitle}} » ({{format}}) a lieu dans environ 36 heures.",
        "",
        "Quand : {{when}}",
        "Où : {{where}}",
        "",
        "{{eventUrl}}",
        "",
        "LA MESA",
      ].join("\n"),
    },
    en: {
      subject: "Reminder — {{eventTitle}} in 36h",
      body: [
        "Hi {{fullName}},",
        "",
        "LA MESA “{{eventTitle}}” ({{format}}) is in about 36 hours.",
        "",
        "When: {{when}}",
        "Where: {{where}}",
        "",
        "{{eventUrl}}",
        "",
        "LA MESA",
      ].join("\n"),
    },
  },
  reminder_90m: {
    es: {
      subject: "Último recordatorio — {{eventTitle}} (en 1 h 30)",
      body: [
        "Estimado/a {{fullName}}:",
        "",
        "Te esperamos en 1 hora y 30 minutos para « {{eventTitle}} ».",
        "",
        "Fecha y hora: {{when}}",
        "Lugar: {{where}}",
        "",
        "{{eventUrl}}",
        "",
        "Hasta pronto,",
        "LA MESA",
      ].join("\n"),
    },
    fr: {
      subject: "Dernier rappel — {{eventTitle}} dans 1h30",
      body: [
        "Bonjour {{fullName}},",
        "",
        "Rendez-vous dans 1h30 pour {{eventTitle}}.",
        "",
        "Quand : {{when}}",
        "Où : {{where}}",
        "",
        "{{eventUrl}}",
        "",
        "À tout de suite,",
        "LA MESA",
      ].join("\n"),
    },
    en: {
      subject: "Final reminder — {{eventTitle}} in 90 min",
      body: [
        "Hi {{fullName}},",
        "",
        "See you in 90 minutes for {{eventTitle}}.",
        "",
        "When: {{when}}",
        "Where: {{where}}",
        "",
        "{{eventUrl}}",
        "",
        "See you soon,",
        "LA MESA",
      ].join("\n"),
    },
  },
  satisfaction_survey: {
    es: {
      subject: "Gracias por {{eventTitle}} — 1 minuto sobre {{format}}",
      body: [
        "Hola {{fullName}},",
        "",
        "Gracias por LA MESA « {{eventTitle}} » ({{format}}).",
        "",
        "Cuéntanos cómo estuvo. Nos sirve para armar la siguiente:",
        "{{surveyUrl}}",
        "",
        "Si otra mesa te encaja, te escribimos. Sin spam.",
        "",
        "Saludos,",
        "LA MESA",
      ].join("\n"),
    },
    fr: {
      subject: "Merci pour {{eventTitle}} — 1 minute sur {{format}}",
      body: [
        "Bonjour {{fullName}},",
        "",
        "Merci pour LA MESA « {{eventTitle}} » ({{format}}).",
        "",
        "Dis-nous comment c’était. Ça nous sert pour la prochaine table :",
        "{{surveyUrl}}",
        "",
        "Si une autre table te correspond, on t’écrit. Pas de spam.",
        "",
        "À bientôt,",
        "LA MESA",
      ].join("\n"),
    },
    en: {
      subject: "Thanks for {{eventTitle}} — 1 minute on {{format}}",
      body: [
        "Hi {{fullName}},",
        "",
        "Thanks for LA MESA “{{eventTitle}}” ({{format}}).",
        "",
        "Tell us how it went. We use it when we build the next table:",
        "{{surveyUrl}}",
        "",
        "If another table fits, we’ll write. No spam.",
        "",
        "See you soon,",
        "LA MESA",
      ].join("\n"),
    },
  },
  light_signup: {
    es: {
      subject: "Gracias por tu registro — LA MESA",
      body: [
        "Gracias {{fullName}} por tu inscripción a LA MESA.",
        "",
        "Cómo funciona:",
        "1. Ya estás en la lista.",
        "2. Completas tu perfil.",
        "3. Te invitamos si una mesa te encaja.",
        "4. Confirmas tu lugar pagando el ticket ACCESS (~$450 MXN en promedio; inclusiones según edición). El menú negociado se paga en el lugar.",
        "",
        "Siguiente paso: completa tu perfil cuando puedas.",
        "",
        "Inicia sesión con el correo usado al registrarte ({{email}}). Google, o crea una contraseña en la página de acceso, y abre tu perfil:",
        "{{loginUrl}}",
        "",
        "Saludos,",
        "LA MESA",
      ].join("\n"),
    },
    fr: {
      subject: "Merci pour ton inscription — LA MESA",
      body: [
        "Merci {{fullName}} pour ton inscription à LA MESA.",
        "",
        "Comment ça marche :",
        "1. Tu es sur la liste.",
        "2. Tu complètes ton profil.",
        "3. On t’invite si une table te correspond.",
        "4. Tu confirmes ta place en réglant le ticket ACCESS (~450 $ MXN en moyenne ; inclus selon l’édition). Le menu négocié se paie sur place.",
        "",
        "Prochaine étape : complète ton profil quand tu peux.",
        "",
        "Connecte-toi avec l’email utilisé à l’inscription ({{email}}). Google, ou crée un mot de passe sur la page de connexion, puis ouvre ton profil :",
        "{{loginUrl}}",
        "",
        "À bientôt,",
        "LA MESA",
      ].join("\n"),
    },
    en: {
      subject: "Thanks for signing up — LA MESA",
      body: [
        "Thank you {{fullName}} for signing up to LA MESA.",
        "",
        "How it works:",
        "1. You’re on the list.",
        "2. You complete your profile.",
        "3. We invite you when a table fits.",
        "4. You confirm your seat by paying the ACCESS ticket (~MXN $450 on average; inclusions depend on the edition). The negotiated menu is paid on site.",
        "",
        "Next step: finish your profile when you can.",
        "",
        "Sign in with the email you used to register ({{email}}). Google, or create a password on the sign-in page, then open your profile:",
        "{{loginUrl}}",
        "",
        "See you soon,",
        "LA MESA",
      ].join("\n"),
    },
  },
  fn_announcement: {
    es: {
      subject: "Te sumamos a LA MESA (desde FrancoNetwork)",
      body: [
        "Hola {{fullName}},",
        "",
        "Al inscribirte en FrancoNetwork, también quedaste en la lista de LA MESA: cenas privadas en Guadalajara, mesas de 14 a 16 personas, un tema por noche. Te escribimos cuando haya una mesa que encaje contigo.",
        "",
        "Tu perfil hoy va al {{profilePercent}}%.",
        "",
        "{{profileMatchNote}}",
        "",
        "Para ver tu perfil, editarlo o salirte de la lista:",
        "{{profileUrl}}",
        "",
        "Primera vez en LA MESA: crea tu acceso en {{loginUrl}} (correo {{email}}, contraseña nueva — no es la de FrancoNetwork).",
        "",
        "Sin compromiso hasta que confirmes una invitación concreta.",
        "",
        "Gregory",
        "LA MESA · Guadalajara",
      ].join("\n"),
    },
    fr: {
      subject: "Ton profil sur LA MESA (depuis FrancoNetwork)",
      body: [
        "Bonjour {{fullName}},",
        "",
        "On a lancé LA MESA Secreta à Guadalajara : dîners et rencontres thématiques, tables composées à la main.",
        "",
        "Comme tu étais sur FrancoNetwork, ton profil est déjà prêt sur la plateforme avec cet email ({{email}}). Tu peux entrer dans le listado et voir ce que tu en penses.",
        "",
        "Première fois : {{loginUrl}}",
        "Crée un compte avec cet email et un nouveau mot de passe (pas celui de FrancoNetwork).",
        "",
        "Ensuite tu peux compléter ou corriger ton profil. Si tu ne veux plus être contacté pour les tables, désactive-le depuis là.",
        "",
        "Sans engagement.",
        "",
        "Gregory",
        "LA MESA · Guadalajara",
      ].join("\n"),
    },
    en: {
      subject: "Your LA MESA profile (from FrancoNetwork)",
      body: [
        "Hi {{fullName}},",
        "",
        "We launched LA MESA Secreta in Guadalajara: thematic dinners and gatherings, tables put together by hand.",
        "",
        "Because you were on FrancoNetwork, your profile is ready on the platform with this email ({{email}}). You can join the list and see how it feels.",
        "",
        "First time: {{loginUrl}}",
        "Create an account with this email and a new password (not your FrancoNetwork one).",
        "",
        "Then you can complete or edit your profile. If you don’t want us to write you about tables, deactivate it there.",
        "",
        "No obligation.",
        "",
        "Gregory",
        "LA MESA · Guadalajara",
      ].join("\n"),
    },
  },
  profile_incomplete: {
    es: {
      subject: "Completa tu perfil en LA MESA",
      body: [
        "Hola {{fullName}},",
        "",
        "Para poder considerarte en próximas mesas, necesitamos tu perfil completo en LA MESA.",
        "",
        "Hoy te falta: {{missingFields}}.",
        "",
        "Entra aquí, revisa tu cuenta y completa lo que falte:",
        "{{loginUrl}}",
        "",
        "Con el perfil al 100% podemos armar mejor las mesas. Sin compromiso de asistir.",
        "",
        "Gregory",
        "LA MESA · Guadalajara",
      ].join("\n"),
    },
    fr: {
      subject: "Complète ton profil sur LA MESA",
      body: [
        "Bonjour {{fullName}},",
        "",
        "Pour pouvoir te considérer pour de prochaines tables, il nous faut ton profil complet sur LA MESA.",
        "",
        "Il manque encore : {{missingFields}}.",
        "",
        "Connecte-toi ici, vérifie ton compte et complète ce qui manque :",
        "{{loginUrl}}",
        "",
        "Avec un profil à 100 %, on compose mieux les tables. Sans engagement de venir.",
        "",
        "Gregory",
        "LA MESA · Guadalajara",
      ].join("\n"),
    },
    en: {
      subject: "Complete your LA MESA profile",
      body: [
        "Hi {{fullName}},",
        "",
        "To consider you for upcoming tables, we need your LA MESA profile complete.",
        "",
        "Still missing: {{missingFields}}.",
        "",
        "Sign in here, review your account, and fill in what’s left:",
        "{{loginUrl}}",
        "",
        "At 100% we can build better tables. No obligation to attend.",
        "",
        "Gregory",
        "LA MESA · Guadalajara",
      ].join("\n"),
    },
  },
  save_the_date: {
    fr: {
      subject: "LA MESA · Save the Date — 24 sept. · dirigeants & entrepreneurs français (GDL)",
      body: [
        "Bonjour {{fullName}},",
        "",
        "Save the Date pour un dîner LA MESA réservé aux dirigeants et entrepreneurs français à Guadalajara.",
        "",
        "{{eventTitle}}",
        "Quand : {{when}}",
        "Où : {{where}}",
        "",
        "Selon ta réponse, tu recevras une invitation formelle avec les détails de LA MESA, ainsi que les modalités de règlement à compléter par transfert avant la rencontre, dans les jours qui viennent.",
        "",
        "Merci de répondre avant lundi 14 septembre via ce lien :",
        "{{eventUrl}}",
        "",
        "Cette invitation est nominative. Seuls les dirigeants / entrepreneurs / fondateurs français sont acceptés. Pour toute question : greg@nextstep-services.com",
        "",
        "Si tu n’as pas encore de profil LA MESA, réponds d’abord au Save the Date, puis crée ton compte sur le site — ta réponse reste prise en compte.",
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
        "Save the Date para una cena LA MESA reservada a dirigentes y emprendedores franceses en Guadalajara.",
        "",
        "{{eventTitle}}",
        "Cuándo: {{when}}",
        "Dónde: {{where}}",
        "",
        "Según tu respuesta, recibirás una invitación formal con los detalles de LA MESA, así como las modalidades de pago a completar por transferencia antes del encuentro, en los próximos días.",
        "",
        "Responde antes del lunes 14 de septiembre aquí:",
        "{{eventUrl}}",
        "",
        "Invitación nominativa. Solo dirigentes / fundadores / emprendedores franceses. Dudas: greg@nextstep-services.com",
        "",
        "Si aún no tienes perfil LA MESA, responde primero y luego crea tu cuenta — tu respuesta ya cuenta.",
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
        "Save the Date for a LA MESA dinner for French directors and entrepreneurs in Guadalajara.",
        "",
        "{{eventTitle}}",
        "When: {{when}}",
        "Where: {{where}}",
        "",
        "Based on your reply, you’ll receive a formal LA MESA invitation with the details, plus payment instructions to complete by bank transfer before the dinner, in the coming days.",
        "",
        "Please reply by Monday 14 September here:",
        "{{eventUrl}}",
        "",
        "Nominative invite. French founders / directors / entrepreneurs only. Questions: greg@nextstep-services.com",
        "",
        "If you don’t have a LA MESA profile yet, reply first, then create your account — your reply still counts.",
        "",
        "Best,",
        "Greg | LA MESA",
      ].join("\n"),
    },
  },
  interest_ack: {
    fr: {
      subject: "LA MESA · Réponse enregistrée — {{eventTitle}}",
      body: [
        "Bonjour {{firstName}},",
        "",
        "Merci — ta réponse au Save the Date est bien enregistrée.",
        "",
        "{{eventTitle}}",
        "Quand : {{when}}",
        "Où : {{where}}",
        "",
        "Ta réponse :",
        "{{interestSummary}}",
        "",
        "Dans les prochains jours, tu recevras sur cette adresse ({{email}}) une invitation formelle pour finaliser ta participation : détails de l’événement et procédures de règlement pour confirmer ta place.",
        "",
        "À bientôt,",
        "Greg | LA MESA",
      ].join("\n"),
    },
    es: {
      subject: "LA MESA · Respuesta registrada — {{eventTitle}}",
      body: [
        "Hola {{firstName}},",
        "",
        "Gracias — tu respuesta al Save the Date quedó registrada.",
        "",
        "{{eventTitle}}",
        "Cuándo: {{when}}",
        "Dónde: {{where}}",
        "",
        "Tu respuesta:",
        "{{interestSummary}}",
        "",
        "En los próximos días recibirás en este correo ({{email}}) una invitación formal para finalizar tu participación: detalles del evento y procedimientos de pago para confirmar tu lugar.",
        "",
        "Saludos,",
        "Greg | LA MESA",
      ].join("\n"),
    },
    en: {
      subject: "LA MESA · Reply recorded — {{eventTitle}}",
      body: [
        "Hi {{firstName}},",
        "",
        "Thanks — your Save the Date reply is recorded.",
        "",
        "{{eventTitle}}",
        "When: {{when}}",
        "Where: {{where}}",
        "",
        "Your reply:",
        "{{interestSummary}}",
        "",
        "In the next few days you’ll receive a formal invitation at this address ({{email}}) to finalize your participation: event details and payment steps to confirm your seat.",
        "",
        "Best,",
        "Greg | LA MESA",
      ].join("\n"),
    },
  },
  referral_invite: {
    es: {
      subject: "{{sponsorName}} te invita a unirte a LA MESA",
      body: [
        "Hola,",
        "",
        "LA MESA son cenas chicas en Guadalajara: una temática por noche, perfiles elegidos para esa mesa. No es un cóctel donde todos se venden.",
        "",
        "{{sponsorName}} te invita a registrarte.",
        "",
        "Regístrate gratis aquí. Si una mesa te encaja, te invitamos.",
        "{{inviteUrl}}",
        "",
        "LA MESA · Guadalajara",
      ].join("\n"),
    },
    fr: {
      subject: "{{sponsorName}} vous invite à rejoindre LA MESA",
      body: [
        "Bonjour,",
        "",
        "LA MESA, ce sont de petits dîners à Guadalajara : une thématique par soirée, des profils choisis pour cette table. Pas un cocktail où tout le monde se vend.",
        "",
        "{{sponsorName}} vous invite à vous inscrire.",
        "",
        "Inscrivez-vous gratuitement ici. Si une table vous correspond, on vous invite.",
        "{{inviteUrl}}",
        "",
        "LA MESA · Guadalajara",
      ].join("\n"),
    },
    en: {
      subject: "{{sponsorName}} invited you to join LA MESA",
      body: [
        "Hello,",
        "",
        "LA MESA is small dinners in Guadalajara: one theme per night, guests picked for that table. Not a cocktail where everyone pitches.",
        "",
        "{{sponsorName}} invited you to sign up.",
        "",
        "Join free here. If a table fits, we invite you.",
        "{{inviteUrl}}",
        "",
        "LA MESA · Guadalajara",
      ].join("\n"),
    },
  },
};

export function resolveTemplateLocale(raw?: string | null): TemplateLocale {
  if (raw === "fr" || raw === "en" || raw === "es") return raw;
  return DEFAULT_SEND_LOCALE;
}

export function templateLabel(key: EmailTemplateKey, storedLabel?: string | null): string {
  if (storedLabel?.trim()) return storedLabel.trim();
  if (isSystemEmailTemplateKey(key)) return EMAIL_TEMPLATE_LABELS[key];
  if (isCustomEmailTemplateKey(key)) {
    return key.replace(/^custom_/, "").replace(/_/g, " ");
  }
  return key;
}

export function defaultEmailTemplate(
  key: EmailTemplateKey,
  locale: TemplateLocale = DEFAULT_SEND_LOCALE,
  opts?: { label?: string },
): EmailTemplateDoc {
  if (isCustomEmailTemplateKey(key)) {
    const locales = customStarterLocales(opts?.label ?? templateLabel(key));
    const pair = locales[locale] ?? locales[DEFAULT_SEND_LOCALE];
    return {
      key,
      locale,
      subject: pair.subject,
      body: pair.body,
      locales,
      enabled: true,
      custom: true,
      label: opts?.label?.trim() || templateLabel(key),
    };
  }
  if (!isSystemEmailTemplateKey(key)) {
    throw new Error(`unknown_template_key:${key}`);
  }
  const locales = DEFAULTS[key];
  const pair = locales[locale] ?? locales[DEFAULT_SEND_LOCALE];
  return {
    key,
    locale,
    subject: pair.subject,
    body: pair.body,
    locales,
    enabled: true,
  };
}

export function defaultLocaleContent(
  key: EmailTemplateKey,
  locale: TemplateLocale,
  opts?: { label?: string },
): LocalePair {
  if (isCustomEmailTemplateKey(key)) {
    const locales = customStarterLocales(opts?.label ?? templateLabel(key));
    return locales[locale] ?? locales[DEFAULT_SEND_LOCALE];
  }
  if (!isSystemEmailTemplateKey(key)) {
    throw new Error(`unknown_template_key:${key}`);
  }
  return DEFAULTS[key][locale] ?? DEFAULTS[key][DEFAULT_SEND_LOCALE];
}
