import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import {
  applyTemplateVars,
  type TemplateVars,
} from "@/lib/email/templates";
import {
  escapeEmailHtml,
  laMesaEmailFooterText,
  wrapLaMesaEmailHtml,
} from "@/lib/email/la-mesa-email-shell";
import { sendProfileIncompleteEmail } from "@/lib/email/send-profile-incomplete";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  computeProfileCompletionPercent,
  isProfileIncomplete,
  listMissingProfileFieldsEs,
} from "@/lib/member/profile-completion";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { getSiteUrl } from "@/lib/site-url";
import type { TemplateLocale, WaitlistRegistration } from "@/lib/types/events";

const BATCH_LIMIT = 80;
const SCAN_LIMIT = 1500;

const ALLOWED_KEYS = new Set(["light_signup", "profile_incomplete"]);

type IncompleteRecipient = {
  id: string;
  fullName: string;
  email: string;
  percent: number;
  source: string;
  missingFields: string;
};

function loginUrlFor(locale: TemplateLocale, email: string): string {
  const params = new URLSearchParams({
    next: "/compte?tab=profil",
    email: email.trim().toLowerCase(),
  });
  return `${getSiteUrl()}/${locale}/connexion?${params.toString()}`;
}

function lightSignupCtaLabel(locale: TemplateLocale): string {
  if (locale === "fr") return "Compléter mon profil maintenant (2 min)";
  if (locale === "en") return "Complete my profile now (2 min)";
  return "Completar mi perfil ahora (2 min)";
}

function lightSignupBodyToHtml(
  bodyText: string,
  loginUrl: string,
  ctaLabel: string,
): string {
  const TOKEN = "__LM_LOGIN__";
  let prepared = bodyText;
  if (loginUrl) prepared = prepared.split(loginUrl).join(TOKEN);
  let html = escapeEmailHtml(prepared).replace(/\n/g, "<br/>");
  if (loginUrl) {
    html = html.split(TOKEN).join(
      `<a href="${escapeEmailHtml(loginUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;margin:8px 0;">${escapeEmailHtml(ctaLabel)}</a>`,
    );
  }
  return html;
}

/** List waitlist members under 100% profile completion. */
export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const templateKey = new URL(request.url).searchParams.get("templateKey")?.trim() ?? "";
  if (!ALLOWED_KEYS.has(templateKey)) {
    return NextResponse.json({ ok: false, error: "template_not_supported" }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const snap = await db.collection(COLLECTIONS.waitlist).limit(SCAN_LIMIT).get();
    const out: IncompleteRecipient[] = [];
    for (const doc of snap.docs) {
      const member = { id: doc.id, ...(doc.data() as Omit<WaitlistRegistration, "id">) };
      if (isSoftDeleted(member)) continue;
      const email = member.email?.trim();
      if (!email) continue;
      if (!isProfileIncomplete(member)) continue;
      const missing = listMissingProfileFieldsEs(member);
      out.push({
        id: member.id,
        fullName: member.fullName?.trim() || email,
        email,
        percent: computeProfileCompletionPercent(member),
        source: member.source?.trim() || "",
        missingFields: missing.length > 0 ? missing.join(", ") : "algunos datos",
      });
    }
    out.sort((a, b) => a.percent - b.percent || a.fullName.localeCompare(b.fullName, "es"));
    return NextResponse.json({
      ok: true,
      recipients: out,
      count: out.length,
      batchLimit: BATCH_LIMIT,
      scanned: snap.size,
      scanLimit: SCAN_LIMIT,
      scanCapped: snap.size >= SCAN_LIMIT,
    });
  } catch (error) {
    console.error("[email-templates/send-incomplete GET]", error);
    return NextResponse.json({ ok: false, error: "list_failed" }, { status: 502 });
  }
}

const postSchema = z
  .object({
    templateKey: z.enum(["light_signup", "profile_incomplete"]),
    ids: z.array(z.string().trim().min(1).max(80)).min(1).max(BATCH_LIMIT),
    locale: z.enum(["es", "fr", "en"]).optional(),
    subject: z.string().trim().min(3).max(300).optional(),
    body: z.string().trim().min(10).max(50_000).optional(),
  })
  .strict();

/** Blast light_signup or profile_incomplete to selected incomplete members. */
export async function POST(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let parsed: z.infer<typeof postSchema>;
  try {
    const raw = await request.json();
    const result = postSchema.safeParse(raw);
    if (!result.success) {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }
    parsed = result.data;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const locale: TemplateLocale = parsed.locale ?? "es";
  const uniqueIds = [...new Set(parsed.ids)];
  if (uniqueIds.length > BATCH_LIMIT) {
    return NextResponse.json(
      { ok: false, error: "batch_limit", batchLimit: BATCH_LIMIT },
      { status: 400 },
    );
  }

  const db = getAdminFirestore();
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const id of uniqueIds) {
    try {
      const snap = await db.collection(COLLECTIONS.waitlist).doc(id).get();
      if (!snap.exists) {
        skipped += 1;
        continue;
      }
      const member = { id: snap.id, ...(snap.data() as Omit<WaitlistRegistration, "id">) };
      if (isSoftDeleted(member) || !member.email?.trim() || !isProfileIncomplete(member)) {
        skipped += 1;
        continue;
      }

      if (parsed.templateKey === "profile_incomplete") {
        const result = await sendProfileIncompleteEmail({
          member,
          force: true,
          ...(parsed.subject && parsed.body
            ? { subject: parsed.subject, body: parsed.body }
            : {}),
        });
        if (!result.ok) {
          errors.push(`${member.email}:${result.error}`);
          continue;
        }
        if (result.skipped) {
          skipped += 1;
          continue;
        }
        sent += 1;
        continue;
      }

      // light_signup — use editor copy when provided
      const email = member.email.trim();
      const loginUrl = loginUrlFor(locale, email);
      const missing = listMissingProfileFieldsEs(member);
      const vars: TemplateVars = {
        fullName: member.fullName?.trim() || email,
        email,
        loginUrl,
        missingFields: missing.length > 0 ? missing.join(", ") : "algunos datos",
        eventTitle: "",
        when: "",
        where: "",
        eventUrl: "",
      };

      if (!parsed.subject || !parsed.body) {
        errors.push(`${email}:missing_template_copy`);
        continue;
      }

      const subject = applyTemplateVars(parsed.subject, vars);
      const bodyText = applyTemplateVars(parsed.body, vars);
      const html = wrapLaMesaEmailHtml({
        lang: locale,
        bodyHtml: lightSignupBodyToHtml(bodyText, loginUrl, lightSignupCtaLabel(locale)),
      });
      const mail = await sendTransactionalEmail({
        to: email,
        subject,
        html,
        text: `${bodyText}\n\n${laMesaEmailFooterText(locale)}`,
        bccAdmins: false,
      });
      if (!mail.ok) {
        errors.push(`${email}:${mail.error}`);
        continue;
      }
      if ("skipped" in mail && mail.skipped) {
        skipped += 1;
        continue;
      }
      sent += 1;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${id}:${msg}`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    sent,
    skipped,
    failed: errors.length,
    errors: errors.slice(0, 30),
    batchLimit: BATCH_LIMIT,
  });
}
