import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { findWaitlistByEmail, findWaitlistByReferralCode } from "@/lib/auth/member.server";
import { verifySurveyToken } from "@/lib/email/rsvp-token";
import { sendSatisfactionGuestInvite } from "@/lib/email/send-satisfaction-survey";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  buildReferralCode,
  normalizeReferralCode,
  randomSuffix,
} from "@/lib/member/referral-code";
import type {
  AdminEventParticipation,
  SatisfactionSurveyAnswers,
  WaitlistRegistration,
} from "@/lib/types/events";
import { getSiteUrl } from "@/lib/site-url";
import { z } from "zod";

const score = z.number().int().min(0).max(5);

const submitSchema = z.object({
  token: z.string().min(10),
  venueQuality: score,
  menuQuality: score,
  guestsQuality: score,
  wouldReturn: score,
  wantInviteOther: z.boolean(),
  invitedEmail: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
});

async function ensureReferralCode(
  profile: WaitlistRegistration & { id: string },
): Promise<string | null> {
  if (profile.referralCode?.trim()) {
    return normalizeReferralCode(profile.referralCode);
  }
  if (!isFirebaseAdminConfigured()) return null;
  const db = getAdminFirestore();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = buildReferralCode(profile.fullName, () => randomSuffix(2));
    const collision = await findWaitlistByReferralCode(code);
    if (!collision) {
      await db.collection(COLLECTIONS.waitlist).doc(profile.id).set(
        { referralCode: code, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      return code;
    }
  }
  return null;
}

export async function POST(request: Request) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  if (parsed.data.wantInviteOther && !parsed.data.invitedEmail?.trim()) {
    return NextResponse.json({ ok: false, error: "invited_email_required" }, { status: 400 });
  }

  const payload = verifySurveyToken(parsed.data.token);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.participations).doc(payload.participationId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const participation = {
    id: snap.id,
    ...(snap.data() as Omit<AdminEventParticipation, "id">),
  };
  if (participation.eventId !== payload.eventId) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  const status = normalizeParticipationStatus(participation.status);
  if (status !== "confirmed" && status !== "attending") {
    return NextResponse.json({ ok: false, error: "not_eligible" }, { status: 403 });
  }

  if (participation.satisfactionSurvey?.submittedAt) {
    return NextResponse.json({ ok: true, alreadySubmitted: true });
  }

  const now = new Date().toISOString();
  const invitedEmail = parsed.data.wantInviteOther
    ? normalizeEmail(parsed.data.invitedEmail ?? "")
    : undefined;

  const survey: SatisfactionSurveyAnswers = {
    venueQuality: parsed.data.venueQuality,
    menuQuality: parsed.data.menuQuality,
    guestsQuality: parsed.data.guestsQuality,
    wouldReturn: parsed.data.wouldReturn,
    wantInviteOther: parsed.data.wantInviteOther,
    invitedEmail: invitedEmail || undefined,
    submittedAt: now,
  };

  await ref.set({ satisfactionSurvey: survey, updatedAt: now }, { merge: true });

  let inviteSent = false;
  if (invitedEmail && invitedEmail !== normalizeEmail(participation.email)) {
    const sponsorName = participation.fullName?.trim() || "Un amigo";
    let inviteUrl = `${getSiteUrl()}/es/inscription`;

    const profile = await findWaitlistByEmail(normalizeEmail(participation.email));
    if (profile) {
      const code = await ensureReferralCode(profile);
      if (code) {
        inviteUrl = `${getSiteUrl()}/es/inscription?ref=${encodeURIComponent(code)}`;
      }
    }

    const mail = await sendSatisfactionGuestInvite({
      to: invitedEmail,
      sponsorFullName: sponsorName,
      inviteUrl,
      locale: "es",
    });
    inviteSent = mail.ok;
    if (!mail.ok) {
      console.error("[satisfaction] guest invite failed", mail.error);
    }
  }

  return NextResponse.json({ ok: true, inviteSent });
}
