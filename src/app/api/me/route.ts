import { NextResponse } from "next/server";
import { isPlatformAdminIdentity, normalizeEmail } from "@/lib/auth/platform-admin";
import {
  findWaitlistByEmail,
  linkWaitlistUid,
  requireVerifiedUser,
} from "@/lib/auth/member.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";

function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

type Fellow = { fullName?: string; companyName?: string; status: string };

export async function GET(request: Request) {
  const user = await requireVerifiedUser(request);
  if (isNextResponse(user)) return user;

  const email = normalizeEmail(user.email!);
  const isAdmin = isPlatformAdminIdentity({ email });

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({
      ok: true,
      profile: null,
      notOnWaitlist: !isAdmin,
      pastInvitations: [],
      upcomingInvitations: [],
      isAdmin,
      dev: true,
    });
  }

  let profile = await findWaitlistByEmail(email);
  if (profile && !profile.uid) {
    await linkWaitlistUid(profile.id, user.uid);
    profile = { ...profile, uid: user.uid, linkedAt: new Date().toISOString() } as typeof profile & {
      uid?: string;
      linkedAt?: string;
    };
  }

  if (!profile && !isAdmin) {
    return NextResponse.json({
      ok: true,
      profile: null,
      notOnWaitlist: true,
      pastInvitations: [],
      upcomingInvitations: [],
      isAdmin: false,
    });
  }

  const db = getAdminFirestore();
  const partsSnap = await db
    .collection(COLLECTIONS.participations)
    .where("email", "==", email)
    .get();

  // Fallback case-insensitive scan if needed
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

  const eventIds = [...new Set(myParts.map((p) => p.eventId).filter(Boolean))];
  const eventsById = new Map<string, AdminEvent>();

  await Promise.all(
    eventIds.map(async (id) => {
      const snap = await db.collection(COLLECTIONS.events).doc(id).get();
      if (snap.exists) {
        eventsById.set(id, { id: snap.id, ...(snap.data() as Omit<AdminEvent, "id">) });
      }
    }),
  );

  const now = Date.now();

  async function fellowsFor(eventId: string): Promise<Fellow[]> {
    const snap = await db
      .collection(COLLECTIONS.participations)
      .where("eventId", "==", eventId)
      .get();
    return snap.docs
      .map((d) => d.data())
      .filter((d) => normalizeEmail(String(d.email ?? "")) !== email)
      .map((d) => ({
        fullName: d.fullName ? String(d.fullName) : undefined,
        companyName: d.companyName ? String(d.companyName) : undefined,
        status: String(d.status ?? "invited"),
      }));
  }

  const pastInvitations = [];
  const upcomingInvitations = [];

  for (const part of myParts) {
    const event = eventsById.get(part.eventId);
    if (!event) continue;
    const starts = new Date(event.startsAt).getTime();
    const fellows = await fellowsFor(part.eventId);
    const entry = {
      participationId: part.id,
      status: part.status,
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        venueName: event.venueName,
        address: event.address,
        mapsUrl: event.mapsUrl,
        status: event.status,
      },
      fellows,
    };
    if (starts < now) pastInvitations.push(entry);
    else upcomingInvitations.push(entry);
  }

  pastInvitations.sort(
    (a, b) => new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime(),
  );
  upcomingInvitations.sort(
    (a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime(),
  );

  return NextResponse.json({
    ok: true,
    profile,
    notOnWaitlist: !profile && !isAdmin,
    pastInvitations,
    upcomingInvitations,
    isAdmin,
  });
}
