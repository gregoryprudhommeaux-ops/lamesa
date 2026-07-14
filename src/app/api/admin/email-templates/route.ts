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
import { translateTemplateLocales } from "@/lib/email/translate-template";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type {
  EmailTemplateKey,
  EmailTemplateLocaleContent,
  TemplateLocale,
} from "@/lib/types/events";
import { z } from "zod";

const TEMPLATE_KEY_SCHEMA = z.enum([
  "calendar_invite",
  "participation_confirmed",
  "reminder_7d",
  "reminder_36h",
  "reminder_90m",
  "satisfaction_survey",
  "light_signup",
  "referral_invite",
]);

async function buildSyncedLocales(input: {
  sourceLocale: TemplateLocale;
  subject: string;
  body: string;
}): Promise<
  | { ok: true; locales: Record<TemplateLocale, EmailTemplateLocaleContent> }
  | { ok: false; error: string }
> {
  try {
    const locales = await translateTemplateLocales(input);
    return { ok: true, locales };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `translate_failed:${msg}` };
  }
}

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
  key: TEMPLATE_KEY_SCHEMA,
  locale: z.enum(["es", "fr", "en"]).default("es"),
  subject: z.string().trim().min(3).max(200).optional(),
  body: z.string().trim().min(10).max(20000).optional(),
  reset: z.boolean().optional(),
  eventId: z.string().min(1).optional(),
  /** Toggle send without editing copy */
  enabled: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (typeof data.enabled === "boolean" && data.subject === undefined && data.body === undefined && !data.reset) {
    return;
  }
  if (data.reset) return;
  if (!data.subject) {
    ctx.addIssue({ code: "custom", message: "subject_required", path: ["subject"] });
  }
  if (!data.body) {
    ctx.addIssue({ code: "custom", message: "body_required", path: ["body"] });
  }
});

type OverrideShape =
  | EmailTemplateLocaleContent
  | {
      locales?: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>>;
      enabled?: boolean;
    };

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

function overrideEnabled(existing: OverrideShape | undefined): boolean | undefined {
  if (!existing || typeof existing !== "object") return undefined;
  if ("enabled" in existing && typeof existing.enabled === "boolean") return existing.enabled;
  return undefined;
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

  const isToggleOnly =
    typeof parsed.data.enabled === "boolean" &&
    parsed.data.subject === undefined &&
    parsed.data.body === undefined &&
    !parsed.data.reset;

  if (isToggleOnly) {
    const enabled = parsed.data.enabled!;
    if (parsed.data.eventId) {
      const eventRef = db.collection(COLLECTIONS.events).doc(parsed.data.eventId);
      const eventSnap = await eventRef.get();
      if (!eventSnap.exists) {
        return NextResponse.json({ ok: false, error: "event_not_found" }, { status: 404 });
      }
      const existingAll =
        (eventSnap.data() as { emailTemplateOverrides?: Record<string, OverrideShape> })
          ?.emailTemplateOverrides ?? {};
      const current = existingAll[key];
      const locales = toLocalesMap(current);
      const nextEntry: OverrideShape =
        Object.keys(locales).length > 0 ? { locales, enabled } : { enabled };
      await eventRef.set(
        {
          emailTemplateOverrides: { ...existingAll, [key]: nextEntry },
          updatedAt: now,
        },
        { merge: true },
      );
      const template = await getEmailTemplate(key, null, locale);
      return NextResponse.json({
        ok: true,
        template: { ...template, enabled, subject: template.subject, body: template.body },
        scope: "event",
        toggled: true,
      });
    }

    const ref = db.collection(COLLECTIONS.emailTemplates).doc(key);
    const snap = await ref.get();
    let locales: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>> = {};
    if (snap.exists) {
      const data = snap.data() as {
        locales?: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>>;
        subject?: string;
        body?: string;
      };
      if (data.locales && Object.keys(data.locales).length > 0) {
        locales = { ...data.locales };
      } else if (data.subject && data.body) {
        locales = { es: { subject: data.subject, body: data.body } };
      }
    }
    await ref.set(
      {
        key,
        enabled,
        updatedAt: now,
        ...(Object.keys(locales).length > 0 ? { locales } : {}),
      },
      { merge: true },
    );
    const template = await getEmailTemplate(key, null, locale);
    return NextResponse.json({
      ok: true,
      template: { ...template, enabled },
      scope: "global",
      toggled: true,
    });
  }

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
    const currentEnabled = overrideEnabled(existingAll[key]);

    if (parsed.data.reset) {
      const nextLocales = { ...currentLocales };
      delete nextLocales[locale];
      const nextOverrides = { ...existingAll };
      if (Object.keys(nextLocales).length === 0 && currentEnabled === undefined) {
        delete nextOverrides[key];
      } else if (Object.keys(nextLocales).length === 0) {
        nextOverrides[key] = { enabled: currentEnabled };
      } else {
        nextOverrides[key] = {
          locales: nextLocales,
          ...(currentEnabled !== undefined ? { enabled: currentEnabled } : {}),
        };
      }
      await eventRef.set(
        { emailTemplateOverrides: nextOverrides, updatedAt: now },
        { merge: true },
      );
      const def = defaultLocaleContent(key, locale);
      return NextResponse.json({
        ok: true,
        template: {
          key,
          locale,
          subject: def.subject,
          body: def.body,
          enabled: currentEnabled !== false,
          updatedAt: now,
        },
        scope: "event",
      });
    }

    const synced = await buildSyncedLocales({
      sourceLocale: locale,
      subject: parsed.data.subject!,
      body: parsed.data.body!,
    });
    if (!synced.ok) {
      return NextResponse.json({ ok: false, error: synced.error }, { status: 502 });
    }
    const content = synced.locales[locale];
    await eventRef.set(
      {
        emailTemplateOverrides: {
          ...existingAll,
          [key]: {
            locales: synced.locales,
            ...(currentEnabled !== undefined ? { enabled: currentEnabled } : {}),
          },
        },
        updatedAt: now,
      },
      { merge: true },
    );
    return NextResponse.json({
      ok: true,
      template: {
        key,
        locale,
        subject: content.subject,
        body: content.body,
        locales: synced.locales,
        enabled: currentEnabled !== false,
        updatedAt: now,
      },
      scope: "event",
      translated: true,
    });
  }

  const ref = db.collection(COLLECTIONS.emailTemplates).doc(key);
  const snap = await ref.get();
  let existingLocales: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>> = {};
  let existingEnabled = true;
  if (snap.exists) {
    const data = snap.data() as {
      locales?: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>>;
      subject?: string;
      body?: string;
      enabled?: boolean;
    };
    existingEnabled = data.enabled !== false;
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
    await ref.set({ key, locales: nextLocales, enabled: existingEnabled, updatedAt: now });
    const pair = nextLocales[locale]!;
    return NextResponse.json({
      ok: true,
      template: {
        key,
        locale,
        subject: pair.subject,
        body: pair.body,
        locales: nextLocales,
        enabled: existingEnabled,
        updatedAt: now,
      },
      scope: "global",
    });
  }

  const synced = await buildSyncedLocales({
    sourceLocale: locale,
    subject: parsed.data.subject!,
    body: parsed.data.body!,
  });
  if (!synced.ok) {
    return NextResponse.json({ ok: false, error: synced.error }, { status: 502 });
  }
  const content = synced.locales[locale];
  await ref.set(
    { key, locales: synced.locales, enabled: existingEnabled, updatedAt: now },
    { merge: true },
  );
  return NextResponse.json({
    ok: true,
    template: {
      key,
      locale,
      subject: content.subject,
      body: content.body,
      locales: synced.locales,
      enabled: existingEnabled,
      updatedAt: now,
    },
    scope: "global",
    translated: true,
  });
}

const deleteSchema = z.object({
  key: TEMPLATE_KEY_SCHEMA,
  locale: z.enum(["es", "fr", "en"]).default("es"),
  eventId: z.string().min(1).optional(),
});

/** Delete custom template copy (all locales) → fall back to code defaults; keep enabled flag. */
export async function DELETE(request: Request) {
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

  const parsed = deleteSchema.safeParse(body);
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
    const keptEnabled = overrideEnabled(existingAll[key]);
    if (!(key in existingAll)) {
      const def = await getEmailTemplate(key, null, locale);
      return NextResponse.json({
        ok: true,
        template: {
          key,
          locale,
          subject: def.subject,
          body: def.body,
          enabled: def.enabled !== false,
          updatedAt: now,
        },
        scope: "event",
        deleted: true,
        alreadyDefault: true,
      });
    }
    const nextOverrides = { ...existingAll };
    if (keptEnabled === undefined) {
      delete nextOverrides[key];
    } else {
      nextOverrides[key] = { enabled: keptEnabled };
    }
    await eventRef.set(
      { emailTemplateOverrides: nextOverrides, updatedAt: now },
      { merge: true },
    );
    const def = defaultLocaleContent(key, locale);
    return NextResponse.json({
      ok: true,
      template: {
        key,
        locale,
        subject: def.subject,
        body: def.body,
        enabled: keptEnabled !== false,
        updatedAt: now,
      },
      scope: "event",
      deleted: true,
    });
  }

  const ref = db.collection(COLLECTIONS.emailTemplates).doc(key);
  const snap = await ref.get();
  const enabled = snap.exists
    ? (snap.data() as { enabled?: boolean }).enabled !== false
    : true;
  await ref.set({ key, enabled, updatedAt: now });
  const def = defaultLocaleContent(key, locale);
  return NextResponse.json({
    ok: true,
    template: {
      key,
      locale,
      subject: def.subject,
      body: def.body,
      locales: Object.fromEntries(
        TEMPLATE_LOCALES.map((loc) => [loc, defaultLocaleContent(key, loc)]),
      ),
      enabled,
      updatedAt: now,
    },
    scope: "global",
    deleted: true,
  });
}
