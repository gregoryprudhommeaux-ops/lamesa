import type {
  AdminEvent,
  EmailTemplateDoc,
  EmailTemplateKey,
  EmailTemplateLocaleContent,
  TemplateLocale,
} from "@/lib/types/events";
import { computeEventIva, formatMxn } from "@/lib/events/pricing";
import { eventPublicUrl, fmtDateTime } from "@/lib/events/utils";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  DEFAULT_SEND_LOCALE,
  defaultEmailTemplate,
  defaultLocaleContent,
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_LABELS,
  isCustomEmailTemplateKey,
  isSystemEmailTemplateKey,
  resolveTemplateLocale,
  slugToCustomTemplateKey,
  SYSTEM_EMAIL_TEMPLATE_KEYS,
  TEMPLATE_LOCALE_LABELS,
  TEMPLATE_LOCALES,
  templateLabel,
} from "@/lib/email/template-defaults";

export {
  defaultEmailTemplate,
  defaultLocaleContent,
  DEFAULT_SEND_LOCALE,
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_LABELS,
  isCustomEmailTemplateKey,
  isSystemEmailTemplateKey,
  resolveTemplateLocale,
  slugToCustomTemplateKey,
  SYSTEM_EMAIL_TEMPLATE_KEYS,
  TEMPLATE_LOCALE_LABELS,
  TEMPLATE_LOCALES,
  templateLabel,
};

export type TemplateVars = {
  fullName: string;
  email?: string;
  firstName?: string;
  loginUrl?: string;
  /** Inviter / sponsor display name (referral + satisfaction invite) */
  sponsorName?: string;
  /** Signup / referral invite link */
  inviteUrl?: string;
  eventTitle: string;
  when: string;
  where: string;
  eventUrl: string;
  yesUrl?: string;
  noUrl?: string;
  surveyUrl?: string;
  /** Price before IVA, formatted (e.g. "$2,500.00 MXN") */
  priceBeforeTax?: string;
  ivaAmount?: string;
  totalWithIva?: string;
  menuIncluded?: string;
};

export function applyTemplateVars(text: string, vars: TemplateVars): string {
  const fallbackName = vars.fullName?.trim() || "amigo/a";
  const firstName =
    vars.firstName?.trim() ||
    fallbackName.split(/\s+/)[0] ||
    fallbackName;
  const sponsorFallback =
    vars.sponsorName?.trim() ||
    (fallbackName !== "amigo/a" ? fallbackName : "Un amigo");
  return text
    .replaceAll("{{fullName}}", fallbackName)
    .replaceAll("{{firstName}}", firstName)
    .replaceAll("{{email}}", vars.email ?? "")
    .replaceAll("{{loginUrl}}", vars.loginUrl ?? "")
    .replaceAll("{{sponsorName}}", sponsorFallback)
    .replaceAll("{{inviteUrl}}", vars.inviteUrl ?? "")
    .replaceAll("{{eventTitle}}", vars.eventTitle)
    .replaceAll("{{when}}", vars.when)
    .replaceAll("{{where}}", vars.where)
    .replaceAll("{{eventUrl}}", vars.eventUrl)
    .replaceAll("{{yesUrl}}", vars.yesUrl ?? "")
    .replaceAll("{{noUrl}}", vars.noUrl ?? "")
    .replaceAll("{{surveyUrl}}", vars.surveyUrl ?? "")
    .replaceAll("{{priceBeforeTax}}", vars.priceBeforeTax ?? "")
    .replaceAll("{{ivaAmount}}", vars.ivaAmount ?? "")
    .replaceAll("{{totalWithIva}}", vars.totalWithIva ?? "")
    .replaceAll("{{menuIncluded}}", vars.menuIncluded ?? "");
}

/** Language used when sending email / WhatsApp for an event. */
export function sendLocaleForEvent(event?: AdminEvent | null): TemplateLocale {
  return resolveTemplateLocale(event?.eventLanguage);
}

export function buildEventTemplateVars(input: {
  event: AdminEvent;
  publicBaseUrl: string;
  fullName: string;
  email?: string;
  yesUrl?: string;
  noUrl?: string;
  surveyUrl?: string;
  locale?: TemplateLocale;
}): TemplateVars {
  const lang = input.locale ?? sendLocaleForEvent(input.event);
  const priceRaw = input.event.priceMxn;
  const hasPrice = typeof priceRaw === "number" && Number.isFinite(priceRaw) && priceRaw > 0;
  const pricing = hasPrice ? computeEventIva(priceRaw) : null;
  const pending =
    lang === "fr" ? "À confirmer" : lang === "en" ? "To be confirmed" : "Por confirmar";
  return {
    fullName: input.fullName,
    email: input.email,
    eventTitle: input.event.title,
    when: fmtDateTime(input.event.startsAt, lang),
    where: [input.event.venueName, input.event.address].filter(Boolean).join(" — "),
    eventUrl: eventPublicUrl(input.publicBaseUrl, input.event.slug, lang),
    yesUrl: input.yesUrl,
    noUrl: input.noUrl,
    surveyUrl: input.surveyUrl,
    priceBeforeTax: pricing ? formatMxn(pricing.priceBeforeTax, lang) : pending,
    ivaAmount: pricing ? formatMxn(pricing.iva, lang) : pending,
    totalWithIva: pricing ? formatMxn(pricing.totalWithIva, lang) : pending,
    menuIncluded:
      input.event.menuIncluded?.trim() ||
      (lang === "fr" ? "Voir la page de l’événement" : lang === "en" ? "See the event page" : "Ver la página del evento"),
  };
}

type StoredOverride =
  | EmailTemplateLocaleContent
  | { locales?: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>> };

function contentFromStored(
  stored: StoredOverride | undefined,
  locale: TemplateLocale,
): EmailTemplateLocaleContent | null {
  if (!stored) return null;
  if ("locales" in stored && stored.locales) {
    const hit = stored.locales[locale];
    if (hit?.subject?.trim() && hit?.body?.trim()) return hit;
    return null;
  }
  if ("subject" in stored && "body" in stored) {
    // Legacy flat override — apply to every locale lookup as fallback for that event
    if (stored.subject?.trim() && stored.body?.trim()) {
      return { subject: stored.subject, body: stored.body };
    }
  }
  return null;
}

function normalizeStoredDoc(
  key: EmailTemplateKey,
  data: Partial<EmailTemplateDoc> & {
    locales?: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>>;
    subject?: string;
    body?: string;
    label?: string;
  },
): Partial<Record<TemplateLocale, EmailTemplateLocaleContent>> {
  if (data.locales && Object.keys(data.locales).length > 0) {
    return data.locales;
  }
  if (data.subject?.trim() && data.body?.trim()) {
    // Legacy single-language doc → treat as Spanish default (send language)
    return {
      [DEFAULT_SEND_LOCALE]: { subject: data.subject, body: data.body },
    };
  }
  return defaultEmailTemplate(key, DEFAULT_SEND_LOCALE, { label: data.label }).locales ?? {};
}

export async function getEmailTemplate(
  key: EmailTemplateKey,
  event?: AdminEvent | null,
  locale?: TemplateLocale | null,
): Promise<EmailTemplateDoc> {
  const lang = resolveTemplateLocale(locale ?? event?.eventLanguage);
  const custom = isCustomEmailTemplateKey(key);

  let enabled = true;
  let storedLocales: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>> | null = null;
  let updatedAt: string | undefined;
  let label: string | undefined;

  if (isFirebaseAdminConfigured()) {
    try {
      const db = getAdminFirestore();
      const snap = await db.collection(COLLECTIONS.emailTemplates).doc(key).get();
      if (snap.exists) {
        const data = snap.data() as Partial<EmailTemplateDoc> & {
          locales?: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>>;
          subject?: string;
          body?: string;
          enabled?: boolean;
          label?: string;
        };
        enabled = data.enabled !== false;
        updatedAt = data.updatedAt;
        label = data.label?.trim() || undefined;
        storedLocales = normalizeStoredDoc(key, data);
      } else if (custom) {
        // Custom key with no Firestore doc yet → starter copy
        const starter = defaultEmailTemplate(key, lang);
        return { ...starter, enabled: true };
      }
    } catch {
      /* fall through */
    }
  }

  const eventOverrideRaw = event?.emailTemplateOverrides?.[key] as
    | (StoredOverride & { enabled?: boolean })
    | undefined;
  if (eventOverrideRaw && typeof eventOverrideRaw === "object" && "enabled" in eventOverrideRaw) {
    if (typeof eventOverrideRaw.enabled === "boolean") {
      enabled = eventOverrideRaw.enabled;
    }
  }

  const meta = {
    ...(custom ? { custom: true as const, label: label ?? templateLabel(key) } : {}),
    ...(label && !custom ? { label } : {}),
  };

  const override = contentFromStored(eventOverrideRaw, lang);
  if (override) {
    return {
      key,
      locale: lang,
      subject: override.subject,
      body: override.body,
      enabled,
      updatedAt,
      ...meta,
    };
  }

  if (storedLocales) {
    const pair = storedLocales[lang] ?? storedLocales[DEFAULT_SEND_LOCALE];
    if (pair?.subject?.trim() && pair?.body?.trim()) {
      return {
        key,
        locale: lang,
        subject: pair.subject,
        body: pair.body,
        locales: storedLocales,
        enabled,
        updatedAt,
        ...meta,
      };
    }
  }

  const fallback = defaultEmailTemplate(key, lang, { label });
  return { ...fallback, enabled, ...meta };
}

/** Whether templated email sends for this key should go out. Default: enabled. */
export async function isEmailTemplateEnabled(
  key: EmailTemplateKey,
  event?: AdminEvent | null,
): Promise<boolean> {
  const doc = await getEmailTemplate(key, event, DEFAULT_SEND_LOCALE);
  return doc.enabled !== false;
}

export async function getEmailTemplateBundle(
  key: EmailTemplateKey,
  event?: AdminEvent | null,
): Promise<Record<TemplateLocale, EmailTemplateLocaleContent>> {
  const out = {} as Record<TemplateLocale, EmailTemplateLocaleContent>;
  for (const loc of TEMPLATE_LOCALES) {
    const doc = await getEmailTemplate(key, event, loc);
    out[loc] = { subject: doc.subject, body: doc.body };
  }
  return out;
}

async function listCustomTemplateKeys(): Promise<EmailTemplateKey[]> {
  if (!isFirebaseAdminConfigured()) return [];
  try {
    const db = getAdminFirestore();
    const snap = await db.collection(COLLECTIONS.emailTemplates).limit(200).get();
    const keys: EmailTemplateKey[] = [];
    for (const doc of snap.docs) {
      const id = doc.id;
      if (!isCustomEmailTemplateKey(id)) continue;
      const data = doc.data() as { custom?: boolean };
      if (data.custom === false) continue;
      keys.push(id);
    }
    return keys.sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function listEmailTemplates(
  locale: TemplateLocale = DEFAULT_SEND_LOCALE,
): Promise<EmailTemplateDoc[]> {
  const out: EmailTemplateDoc[] = [];
  for (const key of SYSTEM_EMAIL_TEMPLATE_KEYS) {
    out.push(await getEmailTemplate(key, null, locale));
  }
  for (const key of await listCustomTemplateKeys()) {
    out.push(await getEmailTemplate(key, null, locale));
  }
  return out;
}
