import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { sendSatisfactionSurveyEmail } from "@/lib/email/send-satisfaction-survey";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  /** Limit to these emails. Empty / omitted = all eligible guests not yet surveyed. */
  emails: z.array(z.string().email()).max(500).optional(),
  dryRun: z.boolean().optional(),
});

function isEligible(p: AdminEventParticipation): boolean {
  if (isOrganizerParticipation(p)) return false;
  const status = normalizeParticipationStatus(p.status);
  if (status !== "confirmed" && status !== "attending") return false;
  if (p.satisfactionSurveySentAt) return false;
  return String(p.email ?? "").includes("@");
}

/**
 * Manual satisfaction survey blast — does not depend on cron / auto-send flag.
 */
export async function POST(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id: eventId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const eventSnap = await db.collection(COLLECTIONS.events).doc(eventId).get();
  if (!eventSnap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const event = { id: eventSnap.id, ...(eventSnap.data() as Omit<AdminEvent, "id">) };

  const partsSnap = await db
    .collection(COLLECTIONS.participations)
    .where("eventId", "==", eventId)
    .limit(500)
    .get();

  const emailFilter = parsed.data.emails?.length
    ? new Set(parsed.data.emails.map((e) => normalizeEmail(e)))
    : null;

  const targets = partsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AdminEventParticipation, "id">) }))
    .filter((p) => isEligible(p))
    .filter((p) => (emailFilter ? emailFilter.has(normalizeEmail(p.email)) : true));

  if (targets.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_recipients",
        detail: "Personne éligible (confirmé/présent, questionnaire pas encore envoyé).",
      },
      { status: 400 },
    );
  }

  if (parsed.data.dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      wouldSend: targets.length,
      emails: targets.map((p) => p.email),
    });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const p of targets) {
    const result = await sendSatisfactionSurveyEmail({
      event,
      participation: p,
      force: true,
    });
    if (result.ok && "skipped" in result && result.skipped) {
      skipped += 1;
      continue;
    }
    if (result.ok) {
      sent += 1;
      const stamp = new Date().toISOString();
      await db.collection(COLLECTIONS.participations).doc(p.id).set(
        { satisfactionSurveySentAt: stamp, updatedAt: stamp },
        { merge: true },
      );
    } else {
      failed += 1;
      errors.push(`${p.email}:${result.error}`);
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    sent,
    skipped,
    failed,
    errors: errors.slice(0, 20),
  });
}
