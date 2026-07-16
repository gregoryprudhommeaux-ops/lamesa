import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import {
  defaultLocaleContent,
  EMAIL_TEMPLATE_KEYS,
  getEmailTemplate,
  isCustomEmailTemplateKey,
  isSystemEmailTemplateKey,
  listEmailTemplates,
  resolveTemplateLocale,
  slugToCustomTemplateKey,
  TEMPLATE_LOCALES,
  defaultEmailTemplate,
} from "@/lib/email/templates";
import { translateTemplateLocales } from "@/lib/email/translate-template";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type {
  EmailTemplateKey,
  EmailTemplateLocaleContent,
  TemplateLocale,
} from "@/lib/types/events";
import { z } from "zod";

const TEMPLATE_KEY_SCHEMA = z
  .string()
  .min(3)
  .max(64)
  .refine((k) => isSystemEmailTemplateKey(k) || isCustomEmailTemplateKey(k), {
    message: "invalid_template_key",
  });

const createSchema = z.object({
  label: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(48).optional(),
});

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
    const templates = await listEmailTemplates(locale);
    // When scoped to an event, re-resolve each key against event overrides
    const withOverrides = [];
    for (const t of templates) {
      withOverrides.push(await getEmailTemplate(t.key, event as never, locale));
    }
    return NextResponse.json({ ok: true, templates: withOverrides, locale });
  }

  const templates = await listEmailTemplates(locale);
  return NextResponse.json({ ok: true, templates, locale });
}

/** Create a custom template (manual / draft) with LA MESA starter copy in ES/FR/EN. */
export async function POST(request: Request) {
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const key = slugToCustomTemplateKey(parsed.data.slug ?? parsed.data.label);
  if (!key) {
    return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.emailTemplates).doc(key);
  const existing = await ref.get();
  if (existing.exists) {
    return NextResponse.json({ ok: false, error: "already_exists", key }, { status: 409 });
  }

  const starter = defaultEmailTemplate(key, "es", { label: parsed.data.label });
  const now = new Date().toISOString();
  await ref.set({
    key,
    custom: true,
    label: parsed.data.label.trim(),
    locales: starter.locales,
    enabled: true,
    updatedAt: now,
  });

  const template = await getEmailTemplate(key, null, "es");
  return NextResponse.json({ ok: true, template }, { status: 201 });
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
  label: z.string().trim().min(2).max(80).optional(),
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
  if (!isSystemEmailTemplateKey(key) && !isCustomEmailTemplateKey(key)) {
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
  let existingLabel: string | undefined;
  let existingCustom = isCustomEmailTemplateKey(key);
  if (snap.exists) {
    const data = snap.data() as {
      locales?: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>>;
      subject?: string;
      body?: string;
      enabled?: boolean;
      label?: string;
      custom?: boolean;
    };
    existingEnabled = data.enabled !== false;
    existingLabel = data.label?.trim() || undefined;
    existingCustom = data.custom === true || existingCustom;
    if (data.locales && Object.keys(data.locales).length > 0) {
      existingLocales = { ...data.locales };
    } else if (data.subject && data.body) {
      existingLocales = { es: { subject: data.subject, body: data.body } };
    }
  }

  const label = parsed.data.label?.trim() || existingLabel;

  if (parsed.data.reset) {
    if (isCustomEmailTemplateKey(key)) {
      const starter = defaultEmailTemplate(key, locale, { label });
      await ref.set({
        key,
        custom: true,
        label: label ?? starter.label,
        locales: starter.locales,
        enabled: existingEnabled,
        updatedAt: now,
      });
      return NextResponse.json({
        ok: true,
        template: {
          ...starter,
          locale,
          enabled: existingEnabled,
          updatedAt: now,
        },
        scope: "global",
      });
    }
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
    {
      key,
      locales: synced.locales,
      enabled: existingEnabled,
      updatedAt: now,
      ...(existingCustom ? { custom: true, label: label ?? key } : {}),
      ...(label ? { label } : {}),
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
      enabled: existingEnabled,
      updatedAt: now,
      ...(existingCustom ? { custom: true, label: label ?? key } : {}),
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
  if (!isSystemEmailTemplateKey(key) && !isCustomEmailTemplateKey(key)) {
    return NextResponse.json({ ok: false, error: "unknown_key" }, { status: 400 });
  }

  const locale = resolveTemplateLocale(parsed.data.locale);
  const db = getAdminFirestore();
  const now = new Date().toISOString();

  if (parsed.data.eventId) {
    if (isCustomEmailTemplateKey(key)) {
      return NextResponse.json(
        { ok: false, error: "custom_templates_are_global_only" },
        { status: 400 },
      );
    }
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

  // Custom templates: hard delete the document
  if (isCustomEmailTemplateKey(key)) {
    if (snap.exists) await ref.delete();
    return NextResponse.json({
      ok: true,
      deleted: true,
      key,
      scope: "global",
      hardDeleted: true,
    });
  }

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
