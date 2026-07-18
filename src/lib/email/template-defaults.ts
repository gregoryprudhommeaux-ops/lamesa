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
        "Te invitamos a la cena privada LA MESA: {{eventTitle}}.",
        "",
        "No compartimos la lista de nombres. En la invitación adelantamos la composición (tema, sectores o roles) cuando está disponible.",
        "",
        "Fecha y hora: {{when}}",
        "Lugar: {{where}}",
        "",
        "Menú e incluidos:",
        "{{menuIncluded}}",
        "",
        "Monto a pagar:",
        "Precio: {{priceBeforeTax}}",
        "IVA (16 %): {{ivaAmount}}",
        "Total: {{totalWithIva}}",
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
        "Tu es invité(e) au dîner privé LA MESA : {{eventTitle}}.",
        "",
        "On ne partage pas la liste nominative. L’invitation peut préciser la composition (thème, secteurs ou rôles) quand elle est disponible.",
        "",
        "Quand : {{when}}",
        "Où : {{where}}",
        "",
        "Menu & inclus :",
        "{{menuIncluded}}",
        "",
        "Montant à régler :",
        "Prix : {{priceBeforeTax}}",
        "IVA (16%) : {{ivaAmount}}",
        "Total : {{totalWithIva}}",
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
        "You’re invited to a private LA MESA dinner: {{eventTitle}}.",
        "",
        "We don’t share a name list. The invitation may outline the makeup (theme, sectors or roles) when available.",
        "",
        "When: {{when}}",
        "Where: {{where}}",
        "",
        "Menu & included:",
        "{{menuIncluded}}",
        "",
        "Amount due:",
        "Price: {{priceBeforeTax}}",
        "IVA (16%): {{ivaAmount}}",
        "Total: {{totalWithIva}}",
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
        "Confirmamos tu participación en la cena « {{eventTitle}} ».",
        "",
        "Fecha y hora: {{when}}",
        "Lugar: {{where}}",
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
        "Ta participation au dîner {{eventTitle}} est confirmée.",
        "",
        "Quand : {{when}}",
        "Où : {{where}}",
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
        "Your spot at {{eventTitle}} is confirmed.",
        "",
        "When: {{when}}",
        "Where: {{where}}",
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
        "Te recordamos que la cena LA MESA « {{eventTitle}} » tendrá lugar en una semana.",
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
        "Rappel : le dîner LA MESA « {{eventTitle}} » a lieu dans une semaine.",
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
        "Reminder: the LA MESA dinner “{{eventTitle}}” is in one week.",
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
        "La cena « {{eventTitle}} » tendrá lugar en aproximadamente 36 horas.",
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
        "Le dîner « {{eventTitle}} » a lieu dans environ 36 heures.",
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
        "The dinner “{{eventTitle}}” is in about 36 hours.",
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
      subject: "Gracias por {{eventTitle}} — 1 minuto sobre la cena",
      body: [
        "Hola {{fullName}},",
        "",
        "Gracias por la cena LA MESA « {{eventTitle}} ».",
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
      subject: "Merci pour {{eventTitle}} — 1 minute sur le dîner",
      body: [
        "Bonjour {{fullName}},",
        "",
        "Merci pour le dîner LA MESA « {{eventTitle}} ».",
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
      subject: "Thanks for {{eventTitle}} — 1 minute on the dinner",
      body: [
        "Hi {{fullName}},",
        "",
        "Thanks for the LA MESA dinner “{{eventTitle}}”.",
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
        "4. Confirmas tu lugar pagando la comida.",
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
        "4. Tu confirmes ta place en payant le repas.",
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
        "4. You confirm your seat by paying for the meal.",
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
