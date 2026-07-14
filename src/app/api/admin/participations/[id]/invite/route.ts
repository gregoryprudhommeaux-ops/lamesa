import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { sendCalendarInviteEmail } from "@/lib/email/send-calendar-invite";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";

type Params = { params: Promise<{ id: string }> };

/** Promote waitlist → invited and send calendar invite (or re-send for invited). */
export async function POST(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;
  const db = getAdminFirestore();
  const partRef = db.collection(COLLECTIONS.participations).doc(id);
  const partSnap = await partRef.get();
  if (!partSnap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const raw = { id: partSnap.id, ...(partSnap.data() as Omit<AdminEventParticipation, "id">) };
  const status = normalizeParticipationStatus(raw.status);

  if (isOrganizerParticipation(raw)) {
    // Re-send calendar ICS only — do not demote organizer status.
    const eventSnap = await db.collection(COLLECTIONS.events).doc(raw.eventId).get();
    if (!eventSnap.exists) {
      return NextResponse.json({ ok: false, error: "event_not_found" }, { status: 404 });
    }
    const event = { id: eventSnap.id, ...(eventSnap.data() as Omit<AdminEvent, "id">) };
    const result = await sendCalendarInviteEmail({ event, participation: raw });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }
    const now = new Date().toISOString();
    await partRef.set({ calendarInviteSentAt: now, updatedAt: now }, { merge: true });
    return NextResponse.json({ ok: true, promoted: false, sent: true, organizer: true });
  }

  if (status !== "waitlist" && status !== "invited" && status !== "not_attending") {
    return NextResponse.json(
      { ok: false, error: "invalid_status", status },
      { status: 400 },
    );
  }

  const eventSnap = await db.collection(COLLECTIONS.events).doc(raw.eventId).get();
  if (!eventSnap.exists) {
    return NextResponse.json({ ok: false, error: "event_not_found" }, { status: 404 });
  }
  const event = { id: eventSnap.id, ...(eventSnap.data() as Omit<AdminEvent, "id">) };

  const now = new Date().toISOString();
  await partRef.set(
    {
      status: "invited",
      statusSource: "admin",
      updatedAt: now,
    },
    { merge: true },
  );

  const participation: AdminEventParticipation = {
    ...raw,
    status: "invited",
    statusSource: "admin",
    updatedAt: now,
  };

  const result = await sendCalendarInviteEmail({ event, participation });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, promoted: true },
      { status: 502 },
    );
  }

  await partRef.set({ calendarInviteSentAt: now, updatedAt: now }, { merge: true });

  return NextResponse.json({ ok: true, promoted: status === "waitlist", sent: true });
}
