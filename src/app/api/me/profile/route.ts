import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import {
  findWaitlistByEmail,
  linkWaitlistUid,
  requireVerifiedUser,
} from "@/lib/auth/member.server";
import { isPlatformAdminIdentity } from "@/lib/auth/platform-admin";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { z } from "zod";

function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

const profilePatchSchema = z.object({
  fullName: z.string().trim().min(3).max(120).optional(),
  linkedinUrl: z.string().trim().url().optional(),
  company: z.string().trim().min(2).max(120).optional(),
  sector: z.string().trim().min(1).max(80).optional(),
  position: z.string().trim().min(1).max(80).optional(),
  extraActivities: z.array(z.string().trim().min(1).max(500)).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(8).max(40).optional(),
  invitationMotivation: z.string().trim().min(10).max(2000).optional(),
});

export async function PATCH(request: Request) {
  const user = await requireVerifiedUser(request);
  if (isNextResponse(user)) return user;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const email = normalizeEmail(user.email!);
  let profile = await findWaitlistByEmail(email);
  if (!profile) {
    if (isPlatformAdminIdentity({ email })) {
      return NextResponse.json({ ok: false, error: "no_profile" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: "not_on_waitlist" }, { status: 403 });
  }

  if (!profile.uid) {
    await linkWaitlistUid(profile.id, user.uid);
  } else if (profile.uid !== user.uid && !isPlatformAdminIdentity({ email })) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = profilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const db = getAdminFirestore();
  await db.collection(COLLECTIONS.waitlist).doc(profile.id).set(
    {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
      uid: user.uid,
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true, id: profile.id });
}

export async function DELETE(request: Request) {
  const user = await requireVerifiedUser(request);
  if (isNextResponse(user)) return user;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const email = normalizeEmail(user.email!);
  const profile = await findWaitlistByEmail(email);
  if (!profile) {
    return NextResponse.json({ ok: false, error: "not_on_waitlist" }, { status: 404 });
  }

  if (profile.uid && profile.uid !== user.uid && !isPlatformAdminIdentity({ email })) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const db = getAdminFirestore();

  const partsSnap = await db
    .collection(COLLECTIONS.participations)
    .where("email", "==", email)
    .get();

  let participationDocs = partsSnap.docs;
  if (participationDocs.length === 0) {
    const all = await db.collection(COLLECTIONS.participations).limit(2000).get();
    participationDocs = all.docs.filter(
      (d) => normalizeEmail(String(d.data().email ?? "")) === email,
    );
  }

  const batch = db.batch();
  batch.delete(db.collection(COLLECTIONS.waitlist).doc(profile.id));
  for (const doc of participationDocs) {
    batch.delete(doc.ref);
  }
  await batch.commit();

  return NextResponse.json({
    ok: true,
    deletedProfileId: profile.id,
    deletedParticipations: participationDocs.length,
  });
}
