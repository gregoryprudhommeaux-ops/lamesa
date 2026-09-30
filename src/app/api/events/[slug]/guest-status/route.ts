import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { requireVerifiedUser } from "@/lib/auth/member.server";
import { resolvePublicEventGuestSurface } from "@/lib/events/public-event-guest-surface";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type {
  AdminEvent,
  AdminEventParticipation,
  EventInterestResponse,
  EventRespondent,
} from "@/lib/types/events";

type Params = { params: Promise<{ slug: string }> };

function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

/**
 * Authenticated guest status for public `/e/[slug]`.
 * Used to switch OUI/NON form → already answered → ACCESS payment.
 */
export async function GET(request: Request, { params }: Params) {
  const user = await requireVerifiedUser(request);
  if (isNextResponse(user)) return user;

  const { slug } = await params;
  const email = normalizeEmail(user.email!);

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({
      ok: true,
      surface: "interest_form",
      interestResponse: null,
      participation: null,
      event: null,
      dev: true,
    });
  }

  try {
    const db = getAdminFirestore();
    const eventSnap = await db
      .collection(COLLECTIONS.events)
      .where("slug", "==", slug)
      .where("status", "==", "published")
      .limit(1)
      .get();

    if (eventSnap.empty) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const eventDoc = eventSnap.docs[0]!;
    const event = {
      id: eventDoc.id,
      ...(eventDoc.data() as Omit<AdminEvent, "id">),
    };

    const [respondentsSnap, partsSnap] = await Promise.all([
      db.collection(COLLECTIONS.respondents).where("email", "==", email).limit(20).get(),
      db.collection(COLLECTIONS.participations).where("email", "==", email).limit(40).get(),
    ]);

    const respondent = respondentsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<EventRespondent, "id">) }))
      .find((r) => String(r.eventId ?? "") === event.id);

    const participation = partsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<AdminEventParticipation, "id">) }))
      .find((p) => String(p.eventId ?? "") === event.id);

    const interestRaw = respondent?.interestResponse;
    const interestResponse: EventInterestResponse | null =
      interestRaw === "yes" || interestRaw === "no" || interestRaw === "other"
        ? interestRaw
        : null;

    const resolved = resolvePublicEventGuestSurface({
      responseMode: event.responseMode,
      interestResponse,
      participation: participation
        ? {
            id: participation.id,
            status: participation.status,
            calendarInviteSentAt: participation.calendarInviteSentAt,
            paymentDeclaredAt: participation.paymentDeclaredAt,
          }
        : null,
    });

    return NextResponse.json({
      ok: true,
      surface: resolved.surface,
      interestResponse: resolved.interestResponse,
      participation: participation
        ? {
            id: participation.id,
            status: participation.status,
            calendarInviteSentAt: participation.calendarInviteSentAt ?? null,
            paymentDeclaredAt: participation.paymentDeclaredAt ?? null,
          }
        : null,
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        priceMxn: event.priceMxn ?? null,
        priceIncludesIva: event.priceIncludesIva !== false,
        priceIncludesService: event.priceIncludesService !== false,
        paymentDeadlineAt: event.paymentDeadlineAt ?? null,
        responseMode: event.responseMode ?? "rsvp",
      },
    });
  } catch (error) {
    console.error("[events guest-status GET]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}
