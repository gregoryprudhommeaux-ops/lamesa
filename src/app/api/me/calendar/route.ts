import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { requireVerifiedUser } from "@/lib/auth/member.server";
import { isFellowVisibleStatus } from "@/lib/events/capacity";
import { formatMesaPublicLabel, resolveMesaNumber } from "@/lib/events/mesa-public-label";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";

function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

type CalendarEventDto = {
  id: string;
  slug: string;
  title: string;
  /** Masked public label for non-invitees (e.g. LA MESA 001). */
  publicLabel?: string;
  mesaNumber?: number;
  startsAt: string;
  endsAt?: string;
  venueName?: string;
  address?: string;
  mapsUrl?: string;
  invited: boolean;
  participationStatus?: string;
  fellows?: Array<{ fullName?: string; companyName?: string; status: "attending" | "confirmed" }>;
};

async function loadPublishedEvents(db: ReturnType<typeof getAdminFirestore>): Promise<AdminEvent[]> {
  try {
    const snap = await db
      .collection(COLLECTIONS.events)
      .where("status", "==", "published")
      .limit(100)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminEvent, "id">) }));
  } catch (error) {
    console.error("[calendar] published events query failed, fallback scan", error);
    const snap = await db.collection(COLLECTIONS.events).limit(80).get();
    return snap.docs
      .filter((d) => String(d.data().status ?? "") === "published")
      .map((d) => ({ id: d.id, ...(d.data() as Omit<AdminEvent, "id">) }));
  }
}

async function loadUserParticipations(
  db: ReturnType<typeof getAdminFirestore>,
  email: string,
): Promise<Array<AdminEventParticipation & { id: string }>> {
  const partsSnap = await db
    .collection(COLLECTIONS.participations)
    .where("email", "==", email)
    .get();

  let myParts = partsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<AdminEventParticipation, "id">),
  }));
  // No full-collection fallback: emails are stored normalized.

  return myParts;
}

export async function GET(request: Request) {
  const user = await requireVerifiedUser(request);
  if (isNextResponse(user)) return user;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: true, events: [], dev: true });
  }

  const email = normalizeEmail(user.email!);
  const db = getAdminFirestore();

  const [publishedEvents, myParts] = await Promise.all([
    loadPublishedEvents(db),
    loadUserParticipations(db, email),
  ]);

  const participationByEventId = new Map(
    myParts.filter((p) => p.eventId).map((p) => [p.eventId, p]),
  );

  const invitedEventIds = [...participationByEventId.keys()];
  const fellowsByEvent = new Map<
    string,
    Array<{ fullName?: string; companyName?: string; status: "attending" | "confirmed" }>
  >();
  await Promise.all(
    invitedEventIds.map(async (eventId) => {
      const snap = await db
        .collection(COLLECTIONS.participations)
        .where("eventId", "==", eventId)
        .limit(80)
        .get();
      fellowsByEvent.set(
        eventId,
        snap.docs
          .map((d) => d.data())
          .filter((d) => normalizeEmail(String(d.email ?? "")) !== email)
          .filter((d) => isFellowVisibleStatus(String(d.status ?? "")))
          .map((d) => {
            const status = normalizeParticipationStatus(String(d.status ?? ""));
            return {
              fullName: d.fullName ? String(d.fullName) : undefined,
              companyName: d.companyName ? String(d.companyName) : undefined,
              status: (status === "attending" ? "attending" : "confirmed") as
                | "attending"
                | "confirmed",
            };
          }),
      );
    }),
  );

  const events: CalendarEventDto[] = [];

  for (const event of publishedEvents) {
    const part = participationByEventId.get(event.id);
    const invited = !!part;
    const mesaNumber = resolveMesaNumber(event, publishedEvents);
    const publicLabel = formatMesaPublicLabel(mesaNumber);

    if (!invited) {
      events.push({
        id: event.id,
        slug: event.slug,
        title: publicLabel,
        publicLabel,
        mesaNumber,
        startsAt: event.startsAt,
        invited: false,
      });
      continue;
    }

    events.push({
      id: event.id,
      slug: event.slug,
      title: event.title,
      publicLabel,
      mesaNumber,
      startsAt: event.startsAt,
      ...(event.endsAt ? { endsAt: event.endsAt } : {}),
      venueName: event.venueName,
      address: event.address,
      mapsUrl: event.mapsUrl,
      invited: true,
      participationStatus: part.status,
      fellows: fellowsByEvent.get(event.id) ?? [],
    });
  }

  events.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return NextResponse.json({ ok: true, events });
}
