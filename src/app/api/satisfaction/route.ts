import { NextResponse } from "next/server";
import { verifySurveyTokenResult } from "@/lib/email/rsvp-token";
import { isPaidGuestStatus } from "@/lib/events/survey-eligibility";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type {
  AdminEventParticipation,
  SatisfactionSurveyAnswers,
} from "@/lib/types/events";
import { z } from "zod";

const score = z.number().int().min(0).max(5);

const submitSchema = z.object({
  token: z.string().min(10),
  venueQuality: score,
  menuQuality: score,
  guestsQuality: score,
  valueForMoney: score,
  wouldReturn: score,
  wouldRecommend: score,
  comment: z.string().max(1000).optional(),
});

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

  const verified = verifySurveyTokenResult(parsed.data.token);
  if (!verified.ok) {
    const error =
      verified.reason === "expired"
        ? "expired_token"
        : verified.reason === "wrong_purpose"
          ? "wrong_token"
          : "invalid_token";
    console.warn("[satisfaction POST] token rejected", { reason: verified.reason });
    return NextResponse.json({ ok: false, error }, { status: 401 });
  }
  const payload = verified.payload;

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
    console.warn("[satisfaction POST] event mismatch", {
      participationId: payload.participationId,
    });
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  if (!isPaidGuestStatus(participation.status)) {
    return NextResponse.json({ ok: false, error: "not_eligible" }, { status: 403 });
  }

  if (participation.satisfactionSurvey?.submittedAt) {
    return NextResponse.json({ ok: true, alreadySubmitted: true });
  }

  const now = new Date().toISOString();
  const comment = parsed.data.comment?.trim() || undefined;
  const survey: SatisfactionSurveyAnswers = {
    venueQuality: parsed.data.venueQuality,
    menuQuality: parsed.data.menuQuality,
    guestsQuality: parsed.data.guestsQuality,
    valueForMoney: parsed.data.valueForMoney,
    wouldReturn: parsed.data.wouldReturn,
    wouldRecommend: parsed.data.wouldRecommend,
    ...(comment ? { comment } : {}),
    submittedAt: now,
  };

  await ref.set({ satisfactionSurvey: survey, updatedAt: now }, { merge: true });

  return NextResponse.json({ ok: true });
}
