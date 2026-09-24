import { NextResponse } from "next/server";
import { verifySurveyToken } from "@/lib/email/rsvp-token";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
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
  const comment = parsed.data.comment?.trim() || undefined;
  const survey: SatisfactionSurveyAnswers = {
    venueQuality: parsed.data.venueQuality,
    menuQuality: parsed.data.menuQuality,
    guestsQuality: parsed.data.guestsQuality,
    wouldReturn: parsed.data.wouldReturn,
    wouldRecommend: parsed.data.wouldRecommend,
    ...(comment ? { comment } : {}),
    submittedAt: now,
  };

  await ref.set({ satisfactionSurvey: survey, updatedAt: now }, { merge: true });

  return NextResponse.json({ ok: true });
}
