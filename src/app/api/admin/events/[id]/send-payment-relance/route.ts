import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { recordLastEmailCampaign } from "@/lib/admin/last-email-campaign";
import { sendTemplatedEventEmail } from "@/lib/email/send-calendar-invite";
import { templateLabel } from "@/lib/email/template-defaults";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { splitPaymentRelanceBatch } from "@/lib/events/payment-relance-batch";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  /** Limit to these emails. Empty / omitted = all “à relancer” (unpaid after formal invite). */
  emails: z.array(z.string().email()).max(500).optional(),
  dryRun: z.boolean().optional(),
});

function isAwaitingPayment(p: AdminEventParticipation): boolean {
  if (isOrganizerParticipation(p)) return false;
  const status = normalizeParticipationStatus(p.status);
  if (status === "confirmed" || status === "not_attending") return false;
  // Prefer people who already got the formal invite; still include seated unpaid.
  return Boolean(p.calendarInviteSentAt) || status === "invited" || status === "attending" || status === "waitlist";
}

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

  const awaiting = partsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AdminEventParticipation, "id">) }))
    .filter((p) => isAwaitingPayment(p))
    .filter((p) => (emailFilter ? emailFilter.has(normalizeEmail(p.email)) : true))
    .filter((p) => String(p.email ?? "").includes("@"));

  if (awaiting.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no_recipients", detail: "Personne en statut « À relancer »." },
      { status: 400 },
    );
  }

  const { toSend: targets, alreadySent } = splitPaymentRelanceBatch(awaiting);

  if (parsed.data.dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      count: targets.length,
      alreadySent: alreadySent.length,
      emails: targets.map((t) => t.email),
    });
  }

  const now = new Date().toISOString();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const sentEmails: string[] = [];

  for (const p of targets) {
    const result = await sendTemplatedEventEmail({
      key: "payment_relance",
      event,
      participation: p,
    });
    if ("skipped" in result && result.skipped) {
      skipped += 1;
      continue;
    }
    if (!result.ok) {
      failed += 1;
      errors.push(`${p.email}:${result.error}`);
      continue;
    }
    sent += 1;
    sentEmails.push(p.email);
    await db.collection(COLLECTIONS.participations).doc(p.id).set(
      { paymentRelanceSentAt: now, updatedAt: now },
      { merge: true },
    );
  }

  if (sentEmails.length > 0) {
    void recordLastEmailCampaign({
      templateKey: "payment_relance",
      templateLabel: templateLabel("payment_relance"),
      sentAt: now,
      recipientEmails: sentEmails,
      eventSlug: event.slug,
      eventId,
      eventTitle: event.title,
      source: "payment_relance",
    });
  }

  return NextResponse.json({
    ok: failed === 0,
    sent,
    failed,
    skipped,
    alreadySent: alreadySent.length,
    targeted: targets.length,
    errors: errors.slice(0, 20),
  });
}
