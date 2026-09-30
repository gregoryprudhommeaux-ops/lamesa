import { NextResponse } from "next/server";
import { isPaidGuestStatus } from "@/lib/events/survey-eligibility";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { resolveSurveyAccess } from "@/lib/satisfaction/survey-access-token";
import type { SatisfactionSurveyAnswers } from "@/lib/types/events";
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

  const resolved = await resolveSurveyAccess(parsed.data.token);
  if (!resolved.ok) {
    console.warn("[satisfaction POST] token rejected", { error: resolved.error });
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 401 });
  }

  const { participation, via } = resolved;
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

  await getAdminFirestore()
    .collection(COLLECTIONS.participations)
    .doc(participation.id)
    .set({ satisfactionSurvey: survey, updatedAt: now }, { merge: true });

  console.info("[satisfaction POST] accepted", { via, participationId: participation.id });
  return NextResponse.json({ ok: true });
}
