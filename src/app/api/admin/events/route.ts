import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { slugify } from "@/lib/events/utils";
import { nextInviteStatus } from "@/lib/events/capacity";
import { eventSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: true, events: [], participations: [], dev: true });
  }

  try {
    const db = getAdminFirestore();
    const [eventsSnap, partsSnap] = await Promise.all([
      db.collection(COLLECTIONS.events).orderBy("startsAt", "desc").limit(100).get(),
      db.collection(COLLECTIONS.participations).limit(2000).get(),
    ]);

    const events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const participations = partsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ ok: true, events, participations });
  } catch (error) {
    console.error("[admin/events GET]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const data = parsed.data;
  const db = getAdminFirestore();
  const now = new Date().toISOString();
  const slug = slugify(data.title);

  try {
    const capacity = data.capacity ?? 15;
    const ref = await db.collection(COLLECTIONS.events).add({
      slug,
      title: data.title,
      organizerName: data.organizerName ?? "LA MESA",
      introText: data.introText ?? "",
      venueName: data.venueName ?? "",
      address: data.address ?? "",
      startsAt: data.startsAt,
      endsAt: data.endsAt ?? null,
      capacity,
      status: data.status ?? "draft",
      eventLanguage: data.eventLanguage ?? "es",
      dressCode: data.dressCode ?? "none_specified",
      parking: data.parking ?? "unknown",
      mapsUrl: data.mapsUrl || null,
      registrationFormUrl: data.registrationFormUrl || null,
      flyerUrl: data.flyerUrl || null,
      shareEnabled: data.shareEnabled ?? false,
      createdAt: now,
      updatedAt: now,
      createdByUid: admin.uid,
    });

    const inviteEmails = data.inviteEmails ?? [];
    let seated = 0;
    for (const inv of inviteEmails) {
      const status = nextInviteStatus(capacity, seated);
      if (status === "invited") seated += 1;
      await db.collection(COLLECTIONS.participations).add({
        eventId: ref.id,
        email: normalizeEmail(inv.email),
        fullName: inv.fullName ?? null,
        companyName: inv.companyName ?? null,
        contactId: inv.contactId ?? null,
        status,
        statusSource: "admin",
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ ok: true, id: ref.id, slug });  } catch (error) {
    console.error("[admin/events POST]", error);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }
}
