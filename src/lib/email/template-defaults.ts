import type { EmailTemplateDoc, EmailTemplateKey, TemplateLocale } from "@/lib/types/events";
import { paymentBankBlock, paymentDeadlineBlock } from "@/lib/events/payment-details";

export const EMAIL_TEMPLATE_KEYS: EmailTemplateKey[] = [
  "calendar_invite",
  "participation_confirmed",
  "reminder_7d",
  "reminder_36h",
  "reminder_90m",
  "satisfaction_survey",
];

export const TEMPLATE_LOCALES: TemplateLocale[] = ["es", "fr", "en"];

/** Default language for email + WhatsApp sends when event has no language. */
export const DEFAULT_SEND_LOCALE: TemplateLocale = "es";

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
  calendar_invite: "Invitation calendrier (ICS + YES/NO)",
  participation_confirmed: "Confirmation après paiement",
  reminder_7d: "Rappel J-7 (legacy email — préférer VALARM ICS)",
  reminder_36h: "Rappel H-36 (legacy email — préférer VALARM ICS)",
  reminder_90m: "Rappel H-1h30 (legacy email — préférer VALARM ICS)",
  satisfaction_survey: "Questionnaire satisfaction (+12h, cron 1×/jour)",
};

export const TEMPLATE_LOCALE_LABELS: Record<TemplateLocale, string> = {
  es: "Español",
  fr: "Français",
  en: "English",
};

type LocalePair = { subject: string; body: string };

const DEFAULTS: Record<EmailTemplateKey, Record<TemplateLocale, LocalePair>> = {
  calendar_invite: {
    es: {
      subject: "Invitación LA MESA — {{eventTitle}}",
      body: [
        "Hola {{fullName}},",
        "",
        "Estás invitado/a a la cena privada LA MESA: {{eventTitle}}.",
        "",
        "Cuándo: {{when}}",
        "Dónde: {{where}}",
        "",
        "Menú e incluido:",
        "{{menuIncluded}}",
        "",
        "Monto a pagar:",
        "Precio: {{priceBeforeTax}}",
        "IVA (16%): {{ivaAmount}}",
        "Total: {{totalWithIva}}",
        "",
        paymentDeadlineBlock("es"),
        "",
        paymentBankBlock("es"),
        "",
        "Confirma tu asistencia (pulsa YES o NO):",
        "YES: {{yesUrl}}",
        "NO: {{noUrl}}",
        "",
        "Página del evento: {{eventUrl}}",
        "",
        "Hay un archivo de calendario (.ics) adjunto a este email.",
        "",
        "Hasta pronto,",
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
        "Hola {{fullName}},",
        "",
        "Tu participación en la cena {{eventTitle}} está confirmada.",
        "",
        "Cuándo: {{when}}",
        "Dónde: {{where}}",
        "",
        "Detalles: {{eventUrl}}",
        "",
        "Nos vemos pronto,",
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
        "Looking forward to seeing you,",
        "LA MESA",
      ].join("\n"),
    },
  },
  reminder_7d: {
    es: {
      subject: "Recordatorio J-7 — {{eventTitle}}",
      body: [
        "Hola {{fullName}},",
        "",
        "Recordatorio: la cena LA MESA « {{eventTitle}} » es en una semana.",
        "",
        "Cuándo: {{when}}",
        "Dónde: {{where}}",
        "",
        "{{eventUrl}}",
        "",
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
      subject: "Recordatorio — {{eventTitle}} en 36h",
      body: [
        "Hola {{fullName}},",
        "",
        "La cena « {{eventTitle}} » es en aproximadamente 36 horas.",
        "",
        "Cuándo: {{when}}",
        "Dónde: {{where}}",
        "",
        "{{eventUrl}}",
        "",
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
      subject: "Último recordatorio — {{eventTitle}} en 1h30",
      body: [
        "Hola {{fullName}},",
        "",
        "Nos vemos en 1h30 para {{eventTitle}}.",
        "",
        "Cuándo: {{when}}",
        "Dónde: {{where}}",
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
      subject: "Gracias por {{eventTitle}} — tu opinión cuenta",
      body: [
        "Hola {{fullName}},",
        "",
        "Gracias por participar en la cena LA MESA « {{eventTitle}} ».",
        "",
        "Ayúdanos a mejorar las próximas mesas — toma 1 minuto para calificar tu experiencia:",
        "{{surveyUrl}}",
        "",
        "Hasta pronto,",
        "LA MESA",
      ].join("\n"),
    },
    fr: {
      subject: "Merci pour {{eventTitle}} — ton avis compte",
      body: [
        "Bonjour {{fullName}},",
        "",
        "Merci d’avoir participé au dîner LA MESA « {{eventTitle}} ».",
        "",
        "Pour nous aider à améliorer les prochaines tables, prends 1 minute pour noter ton expérience :",
        "{{surveyUrl}}",
        "",
        "À bientôt,",
        "LA MESA",
      ].join("\n"),
    },
    en: {
      subject: "Thanks for {{eventTitle}} — we’d love your feedback",
      body: [
        "Hi {{fullName}},",
        "",
        "Thanks for joining the LA MESA dinner “{{eventTitle}}”.",
        "",
        "Help us improve the next tables — take 1 minute to rate your experience:",
        "{{surveyUrl}}",
        "",
        "See you soon,",
        "LA MESA",
      ].join("\n"),
    },
  },
};

export function resolveTemplateLocale(raw?: string | null): TemplateLocale {
  if (raw === "fr" || raw === "en" || raw === "es") return raw;
  return DEFAULT_SEND_LOCALE;
}

export function defaultEmailTemplate(
  key: EmailTemplateKey,
  locale: TemplateLocale = DEFAULT_SEND_LOCALE,
): EmailTemplateDoc {
  const locales = DEFAULTS[key];
  const pair = locales[locale] ?? locales[DEFAULT_SEND_LOCALE];
  return {
    key,
    locale,
    subject: pair.subject,
    body: pair.body,
    locales,
  };
}

export function defaultLocaleContent(
  key: EmailTemplateKey,
  locale: TemplateLocale,
): LocalePair {
  return DEFAULTS[key][locale] ?? DEFAULTS[key][DEFAULT_SEND_LOCALE];
}
