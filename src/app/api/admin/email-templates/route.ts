import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import {
  defaultLocaleContent,
  EMAIL_TEMPLATE_KEYS,
  getEmailTemplate,
  listEmailTemplates,
  resolveTemplateLocale,
  TEMPLATE_LOCALES,
} from "@/lib/email/templates";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type {
  EmailTemplateKey,
  EmailTemplateLocaleContent,
  TemplateLocale,
} from "@/lib/types/events";
import { z } from "zod";

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  const url = new URL(request.url);
  const locale = resolveTemplateLocale(url.searchParams.get("locale"));
  const eventId = url.searchParams.get("eventId");

  if (eventId && isFirebaseAdminConfigured()) {
    const db = getAdminFirestore();
    const eventSnap = await db.collection(COLLECTIONS.events).doc(eventId).get();
    const event = eventSnap.exists
      ? { id: eventSnap.id, ...(eventSnap.data() as object) }
      : null;
    const templates = [];
    for (const key of EMAIL_TEMPLATE_KEYS) {
      templates.push(await getEmailTemplate(key, event as never, locale));
    }
    return NextResponse.json({ ok: true, templates, locale });
  }

  const templates = await listEmailTemplates(locale);
  return NextResponse.json({ ok: true, templates, locale });
}

const putSchema = z.object({
  key: z.enum([
    "calendar_invite",
    "participation_confirmed",
    "reminder_7d",
    "reminder_36h",
    "reminder_90m",
    "satisfaction_survey",
  ]),
  locale: z.enum(["es", "fr", "en"]).default("es"),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(20000),
  reset: z.boolean().optional(),
  eventId: z.string().min(1).optional(),
});

type OverrideShape =
  | EmailTemplateLocaleContent
  | { locales?: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>> };

function toLocalesMap(existing: OverrideShape | undefined): Partial<
  Record<TemplateLocale, EmailTemplateLocaleContent>
> {
  if (!existing) return {};
  if ("locales" in existing && existing.locales) return { ...existing.locales };
  if ("subject" in existing && "body" in existing && existing.subject && existing.body) {
    return { es: { subject: existing.subject, body: existing.body } };
  }
  return {};
}

export async function PUT(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const key = parsed.data.key as EmailTemplateKey;
  if (!EMAIL_TEMPLATE_KEYS.includes(key)) {
    return NextResponse.json({ ok: false, error: "unknown_key" }, { status: 400 });
  }

  const locale = resolveTemplateLocale(parsed.data.locale);
  const db = getAdminFirestore();
  const now = new Date().toISOString();

  if (parsed.data.eventId) {
    const eventRef = db.collection(COLLECTIONS.events).doc(parsed.data.eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return NextResponse.json({ ok: false, error: "event_not_found" }, { status: 404 });
    }
    const existingAll =
      (eventSnap.data() as { emailTemplateOverrides?: Record<string, OverrideShape> })
        ?.emailTemplateOverrides ?? {};
    const currentLocales = toLocalesMap(existingAll[key]);

    if (parsed.data.reset) {
      const nextLocales = { ...currentLocales };
      delete nextLocales[locale];
      const nextOverrides = { ...existingAll };
      if (Object.keys(nextLocales).length === 0) {
        delete nextOverrides[key];
      } else {
        nextOverrides[key] = { locales: nextLocales };
      }
      await eventRef.set(
        { emailTemplateOverrides: nextOverrides, updatedAt: now },
        { merge: true },
      );
      const def = defaultLocaleContent(key, locale);
      return NextResponse.json({
        ok: true,
        template: { key, locale, subject: def.subject, body: def.body, updatedAt: now },
        scope: "event",
      });
    }

    const content = { subject: parsed.data.subject, body: parsed.data.body };
    await eventRef.set(
      {
        emailTemplateOverrides: {
          ...existingAll,
          [key]: { locales: { ...currentLocales, [locale]: content } },
        },
        updatedAt: now,
      },
      { merge: true },
    );
    return NextResponse.json({
      ok: true,
      template: { key, locale, ...content, updatedAt: now },
      scope: "event",
    });
  }

  const ref = db.collection(COLLECTIONS.emailTemplates).doc(key);
  const snap = await ref.get();
  let existingLocales: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>> = {};
  if (snap.exists) {
    const data = snap.data() as {
      locales?: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>>;
      subject?: string;
      body?: string;
    };
    if (data.locales && Object.keys(data.locales).length > 0) {
      existingLocales = { ...data.locales };
    } else if (data.subject && data.body) {
      existingLocales = { es: { subject: data.subject, body: data.body } };
    }
  }

  if (parsed.data.reset) {
    const nextLocales: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>> = {
      ...existingLocales,
    };
    nextLocales[locale] = defaultLocaleContent(key, locale);
    for (const loc of TEMPLATE_LOCALES) {
      if (!nextLocales[loc]) nextLocales[loc] = defaultLocaleContent(key, loc);
    }
    await ref.set({ key, locales: nextLocales, updatedAt: now });
    const pair = nextLocales[locale]!;
    return NextResponse.json({
      ok: true,
      template: { key, locale, subject: pair.subject, body: pair.body, locales: nextLocales, updatedAt: now },
      scope: "global",
    });
  }

  const content = { subject: parsed.data.subject, body: parsed.data.body };
  const nextLocales: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>> = {
    ...existingLocales,
    [locale]: content,
  };
  for (const loc of TEMPLATE_LOCALES) {
    if (!nextLocales[loc]) nextLocales[loc] = defaultLocaleContent(key, loc);
  }
  await ref.set({ key, locales: nextLocales, updatedAt: now }, { merge: true });
  return NextResponse.json({
    ok: true,
    template: {
      key,
      locale,
      subject: content.subject,
      body: content.body,
      locales: nextLocales,
      updatedAt: now,
    },
    scope: "global",
  });
}
