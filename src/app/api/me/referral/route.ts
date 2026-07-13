import { NextResponse } from "next/server";
import { z } from "zod";
import {
  findWaitlistByEmail,
  findWaitlistByReferralCode,
  requireVerifiedUser,
} from "@/lib/auth/member.server";
import { isPlatformAdminIdentity, normalizeEmail } from "@/lib/auth/platform-admin";
import { sendReferralInviteEmail } from "@/lib/email/send-referral-invite";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  buildReferralCode,
  normalizeReferralCode,
  randomSuffix,
} from "@/lib/member/referral-code";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type { WaitlistRegistration } from "@/lib/types/events";

function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

type AppLocale = "fr" | "en" | "es";

function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://127.0.0.1:3000";
}

function resolveLocaleFromRequest(request: Request, queryLocale?: string | null): AppLocale {
  if (queryLocale === "en" || queryLocale === "es" || queryLocale === "fr") return queryLocale;
  const accept = request.headers.get("accept-language")?.toLowerCase() ?? "";
  if (accept.includes("fr")) return "fr";
  if (accept.includes("en")) return "en";
  return "es";
}

function buildInviteUrl(locale: AppLocale, referralCode: string): string {
  return `${siteUrl()}/${locale}/inscription?ref=${encodeURIComponent(referralCode)}`;
}

const referralPostSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ensure"),
    locale: z.enum(["fr", "en", "es"]).optional(),
  }),
  z.object({
    action: z.literal("invite_email"),
    email: z.string().trim().email().max(254),
    locale: z.enum(["fr", "en", "es"]).optional(),
  }),
]);

async function ensureReferralCodeForProfile(
  profile: WaitlistRegistration & { id: string },
): Promise<{ ok: true; referralCode: string } | { ok: false; error: string; status: number }> {
  if (profile.referralCode?.trim()) {
    return { ok: true, referralCode: normalizeReferralCode(profile.referralCode) };
  }

  if (!isFirebaseAdminConfigured()) {
    return { ok: false, error: "not_configured", status: 503 };
  }

  const db = getAdminFirestore();
  let lastCode = "";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = buildReferralCode(profile.fullName, () => randomSuffix(2));
    lastCode = code;
    const collision = await findWaitlistByReferralCode(code);
    if (!collision) {
      await db.collection(COLLECTIONS.waitlist).doc(profile.id).set(
        {
          referralCode: code,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      return { ok: true, referralCode: code };
    }
  }

  const fallback = buildReferralCode(profile.fullName, () => randomSuffix(4));
  const collision = await findWaitlistByReferralCode(fallback);
  if (collision) {
    console.error("[referral] failed to allocate unique code after retries:", lastCode);
    return { ok: false, error: "code_generation_failed", status: 500 };
  }

  await db.collection(COLLECTIONS.waitlist).doc(profile.id).set(
    {
      referralCode: fallback,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  return { ok: true, referralCode: fallback };
}

export async function GET(request: Request) {
  const user = await requireVerifiedUser(request);
  if (isNextResponse(user)) return user;

  const email = normalizeEmail(user.email!);
  const { searchParams } = new URL(request.url);
  const locale = resolveLocaleFromRequest(request, searchParams.get("locale"));
  const canBeSponsor = !isPlatformAdminIdentity({ email });

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({
      ok: true,
      referralCode: null,
      canBeSponsor,
      inviteUrl: null,
      referees: [],
      dev: true,
    });
  }

  const profile = await findWaitlistByEmail(email);
  if (!profile) {
    return NextResponse.json({ ok: false, error: "not_on_waitlist" }, { status: 404 });
  }

  const referralCode = profile.referralCode?.trim()
    ? normalizeReferralCode(profile.referralCode)
    : null;

  const db = getAdminFirestore();
  const byIdSnap = await db
    .collection(COLLECTIONS.waitlist)
    .where("referredById", "==", profile.id)
    .get();

  let refereeDocs = byIdSnap.docs;
  if (referralCode) {
    const byCodeSnap = await db
      .collection(COLLECTIONS.waitlist)
      .where("referredByCode", "==", referralCode)
      .get();
    const seen = new Set(refereeDocs.map((d) => d.id));
    refereeDocs = [...refereeDocs, ...byCodeSnap.docs.filter((d) => !seen.has(d.id))];
  }

  const referees = refereeDocs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<WaitlistRegistration, "id">) }))
    .filter((row) => !isSoftDeleted(row) && row.referralAcceptedAt)
    .map((row) => ({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      createdAt: row.createdAt,
      referralAcceptedAt: row.referralAcceptedAt!,
    }))
    .sort(
      (a, b) =>
        new Date(b.referralAcceptedAt).getTime() - new Date(a.referralAcceptedAt).getTime(),
    );

  return NextResponse.json({
    ok: true,
    referralCode,
    canBeSponsor,
    inviteUrl: referralCode ? buildInviteUrl(locale, referralCode) : null,
    referees,
  });
}

export async function POST(request: Request) {
  const user = await requireVerifiedUser(request);
  if (isNextResponse(user)) return user;

  const email = normalizeEmail(user.email!);
  if (isPlatformAdminIdentity({ email })) {
    return NextResponse.json({ ok: false, error: "admin_cannot_sponsor" }, { status: 403 });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = referralPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const profile = await findWaitlistByEmail(email);
  if (!profile) {
    return NextResponse.json({ ok: false, error: "not_on_waitlist" }, { status: 404 });
  }

  const ensured = await ensureReferralCodeForProfile(profile);
  if (!ensured.ok) {
    return NextResponse.json({ ok: false, error: ensured.error }, { status: ensured.status });
  }

  if (parsed.data.action === "ensure") {
    const locale = parsed.data.locale ?? resolveLocaleFromRequest(request);
    return NextResponse.json({
      ok: true,
      referralCode: ensured.referralCode,
      inviteUrl: buildInviteUrl(locale, ensured.referralCode),
    });
  }

  const mailLocale = parsed.data.locale ?? resolveLocaleFromRequest(request);
  const inviteUrl = buildInviteUrl(mailLocale, ensured.referralCode);
  const mail = await sendReferralInviteEmail({
    to: normalizeEmail(parsed.data.email),
    sponsorFullName: profile.fullName,
    inviteUrl,
    locale: mailLocale,
  });

  if (!mail.ok) {
    console.warn("[referral] invite email failed:", mail.error);
    return NextResponse.json({ ok: false, error: mail.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    referralCode: ensured.referralCode,
    inviteUrl,
    emailSent: true,
  });
}
