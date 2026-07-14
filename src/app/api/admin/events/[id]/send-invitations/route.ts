import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { sendCalendarInviteEmail } from "@/lib/email/send-calendar-invite";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { ensureOrganizerParticipation } from "@/lib/events/ensure-organizer-participation";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { z } from "zod";

const sendSchema = z.object({
  /** Ignored for calendar invites — kept for backward compat with the admin modal */
  subject: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(20000).optional(),
  includeWaitlist: z.boolean().optional(),
  participationIds: z.array(z.string().min(1)).optional(),
});

type Params = { params: Promise<{ id: string }> };

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

  const parsed = sendSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const eventSnap = await db.collection(COLLECTIONS.events).doc(eventId).get();
  if (!eventSnap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const event = { id: eventSnap.id, ...(eventSnap.data() as Omit<AdminEvent, "id">) };

  await ensureOrganizerParticipation(db, eventId);

  const partsSnap = await db
    .collection(COLLECTIONS.participations)
    .where("eventId", "==", eventId)
    .get();

  const idFilter = parsed.data.participationIds?.length
    ? new Set(parsed.data.participationIds)
    : null;

  // Waitlist never receives calendar invites until promoted (INVITER).
  // Organizer always gets their own ICS (confirmed seat, separate from guests).
  const recipients = partsSnap.docs
    .map((d) => {
      const p = { id: d.id, ...(d.data() as Omit<AdminEventParticipation, "id">) };
      return { ...p, status: normalizeParticipationStatus(p.status) };
    })
    .filter((p) => (idFilter ? idFilter.has(p.id) : true))
    .filter((p) => {
      if (isOrganizerParticipation(p)) return true;
      return p.status === "invited";
    })
    .filter((p) => String(p.email ?? "").includes("@"));

  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "no_recipients" }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const now = new Date().toISOString();

  for (const p of recipients) {
    const result = await sendCalendarInviteEmail({ event, participation: p });
    if (result.ok && "skipped" in result && result.skipped) {
      skipped += 1;
      continue;
    }
    if (result.ok) {
      sent += 1;
      await db.collection(COLLECTIONS.participations).doc(p.id).set(
        { calendarInviteSentAt: now, updatedAt: now },
        { merge: true },
      );
    } else {
      failed += 1;
      errors.push(`${p.email}:${result.error}`);
    }
  }

  if (sent > 0 || skipped === recipients.length) {
    await db.collection(COLLECTIONS.events).doc(eventId).set(
      {
        ...(sent > 0 ? { inviteEmailSentAt: now } : {}),
        updatedAt: now,
      },
      { merge: true },
    );
  }

  if (sent === 0 && failed === 0 && skipped > 0) {
    return NextResponse.json({
      ok: false,
      error: "template_disabled",
      sent: 0,
      failed: 0,
      skipped,
      recipientCount: recipients.length,
      errors: [
        "Le template « Invitation calendrier » est désactivé (Dashboard → Templates). Réactive-le pour envoyer.",
      ],
    });
  }

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    skipped,
    recipientCount: recipients.length,
    errors: errors.slice(0, 10),
  });
}
