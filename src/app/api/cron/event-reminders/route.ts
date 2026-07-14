import { NextResponse } from "next/server";
import { sendSatisfactionSurveyEmail } from "@/lib/email/send-satisfaction-survey";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";

/**
 * Daily follow-up only (satisfaction survey).
 * Pre-event reminders live in the ICS VALARM (native calendar), not email cron.
 *
 * Window: 12h–48h after startsAt, so a once-daily job still catches dinners
 * regardless of exact start time.
 */
const SURVEY_MIN_AFTER_MS = 12 * 60 * 60 * 1000;
const SURVEY_MAX_AFTER_MS = 48 * 60 * 60 * 1000;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV === "development";
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const q = new URL(request.url).searchParams.get("secret") ?? "";
  return bearer === secret || q === secret;
}

async function runDailyFollowups() {
  if (!isFirebaseAdminConfigured()) {
    return { ok: false as const, error: "not_configured" };
  }

  const db = getAdminFirestore();
  const now = Date.now();
  const eventsSnap = await db.collection(COLLECTIONS.events).limit(200).get();
  const events = eventsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<AdminEvent, "id">),
  }));

  let checked = 0;
  let surveysSent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const event of events) {
    if (!event.startsAt) continue;
    const startMs = new Date(event.startsAt).getTime();
    if (Number.isNaN(startMs)) continue;

    const elapsed = now - startMs;
    if (elapsed < SURVEY_MIN_AFTER_MS || elapsed > SURVEY_MAX_AFTER_MS) continue;

    const partsSnap = await db
      .collection(COLLECTIONS.participations)
      .where("eventId", "==", event.id)
      .get();

    for (const doc of partsSnap.docs) {
      const p = {
        id: doc.id,
        ...(doc.data() as Omit<AdminEventParticipation, "id">),
      };
      checked += 1;
      const status = normalizeParticipationStatus(p.status);

      if (isOrganizerParticipation(p)) {
        skipped += 1;
        continue;
      }
      if (status !== "confirmed" && status !== "attending") {
        skipped += 1;
        continue;
      }
      if (p.satisfactionSurveySentAt) {
        skipped += 1;
        continue;
      }

      const result = await sendSatisfactionSurveyEmail({ event, participation: p });
      if (result.ok && "skipped" in result && result.skipped) {
        skipped += 1;
        continue;
      }
      if (result.ok) {
        surveysSent += 1;
        const stamp = new Date().toISOString();
        await doc.ref.set({ satisfactionSurveySentAt: stamp, updatedAt: stamp }, { merge: true });
      } else {
        errors.push(`${p.email}:satisfaction_survey:${result.error}`);
      }
    }
  }

  return {
    ok: true as const,
    checked,
    surveysSent,
    skipped,
    errors: errors.slice(0, 20),
  };
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await runDailyFollowups();
  if (!result.ok) {
    return NextResponse.json(result, { status: 503 });
  }
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
