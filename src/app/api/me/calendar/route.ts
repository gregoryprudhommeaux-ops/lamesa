import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { requireVerifiedUser } from "@/lib/auth/member.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";

function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

type CalendarEventDto = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  venueName?: string;
  address?: string;
  mapsUrl?: string;
  invited: boolean;
  participationStatus?: string;
  fellows?: Array<{ fullName?: string; companyName?: string; status: "present" }>;
};

async function loadPublishedEvents(db: ReturnType<typeof getAdminFirestore>): Promise<AdminEvent[]> {
  try {
    const snap = await db.collection(COLLECTIONS.events).where("status", "==", "published").get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminEvent, "id">) }));
  } catch (error) {
    console.error("[calendar] published events query failed, fallback scan", error);
    const snap = await db.collection(COLLECTIONS.events).limit(500).get();
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

  if (myParts.length === 0) {
    const all = await db.collection(COLLECTIONS.participations).limit(2000).get();
    myParts = all.docs
      .filter((d) => normalizeEmail(String(d.data().email ?? "")) === email)
      .map((d) => ({ id: d.id, ...(d.data() as Omit<AdminEventParticipation, "id">) }));
  }

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

  async function fellowsFor(eventId: string) {
    const snap = await db
      .collection(COLLECTIONS.participations)
      .where("eventId", "==", eventId)
      .get();
    return snap.docs
      .map((d) => d.data())
      .filter((d) => normalizeEmail(String(d.email ?? "")) !== email)
      .filter((d) => String(d.status ?? "invited") === "present")
      .map((d) => ({
        fullName: d.fullName ? String(d.fullName) : undefined,
        companyName: d.companyName ? String(d.companyName) : undefined,
        status: "present" as const,
      }));
  }

  const events: CalendarEventDto[] = [];

  for (const event of publishedEvents) {
    const part = participationByEventId.get(event.id);
    const invited = !!part;

    if (!invited) {
      events.push({
        id: event.id,
        slug: event.slug,
        title: event.title,
        startsAt: event.startsAt,
        ...(event.endsAt ? { endsAt: event.endsAt } : {}),
        invited: false,
      });
      continue;
    }

    const fellows = await fellowsFor(event.id);
    events.push({
      id: event.id,
      slug: event.slug,
      title: event.title,
      startsAt: event.startsAt,
      ...(event.endsAt ? { endsAt: event.endsAt } : {}),
      venueName: event.venueName,
      address: event.address,
      mapsUrl: event.mapsUrl,
      invited: true,
      participationStatus: part.status,
      fellows,
    });
  }

  events.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return NextResponse.json({ ok: true, events });
}
