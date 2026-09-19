import { NextResponse } from "next/server";
import { buildCalendarInviteIcs } from "@/lib/email/ics";
import { brevoFromAddress } from "@/lib/email/send-transactional";
import { verifyRsvpToken } from "@/lib/email/rsvp-token";
import { formatEventWhereLine } from "@/lib/events/format-where";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getSiteUrl } from "@/lib/site-url";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";

type Params = { params: Promise<{ token: string }> };

/**
 * Downloadable calendar invite (.ics) with VALARM reminders.
 * Used as a visible fallback when clients hide Brevo attachments.
 */
export async function GET(request: Request, { params }: Params) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken ?? "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  const payload = verifyRsvpToken(token);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const db = getAdminFirestore();
  const [eventSnap, partSnap] = await Promise.all([
    db.collection(COLLECTIONS.events).doc(payload.eventId).get(),
    db.collection(COLLECTIONS.participations).doc(payload.participationId).get(),
  ]);

  if (!eventSnap.exists || !partSnap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const event = { id: eventSnap.id, ...(eventSnap.data() as Omit<AdminEvent, "id">) };
  const participation = {
    id: partSnap.id,
    ...(partSnap.data() as Omit<AdminEventParticipation, "id">),
  };

  if (participation.eventId !== event.id) {
    return NextResponse.json({ ok: false, error: "mismatch" }, { status: 400 });
  }

  const from = brevoFromAddress();
  const location = formatEventWhereLine(event.venueName, event.address);
  const site = getSiteUrl();
  const eventUrl = `${site}/e/${encodeURIComponent(event.slug ?? event.id)}`;

  const ics = buildCalendarInviteIcs({
    uid: `${event.id}-${participation.id}@lamesa`,
    title: `LA MESA — ${event.title}`,
    description: `LA MESA — ${event.title}\n${eventUrl}`,
    location,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    organizerEmail: from.email,
    organizerName: event.organizerName ?? from.name ?? "LA MESA",
    attendeeEmail: participation.email,
    attendeeName: participation.fullName,
    url: eventUrl,
  });

  const disposition =
    new URL(request.url).searchParams.get("inline") === "1" ? "inline" : "attachment";

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": 'text/calendar; charset=utf-8; method=REQUEST',
      "Content-Disposition": `${disposition}; filename="la-mesa-invite.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
