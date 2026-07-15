import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import {
  findWaitlistByEmail,
  linkWaitlistUid,
  requireVerifiedUser,
} from "@/lib/auth/member.server";
import { isPlatformAdminIdentity } from "@/lib/auth/platform-admin";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { syncWaitlistMemberToDatabasePerso } from "@/lib/member/sync-database-perso";
import { z } from "zod";

function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

const profilePatchSchema = z.object({
  fullName: z.string().trim().min(3).max(120).optional(),
  linkedinUrl: z
    .union([z.literal(""), z.string().trim().url()])
    .optional(),
  company: z.string().trim().max(120).optional(),
  sector: z.string().trim().max(80).optional(),
  position: z.string().trim().max(80).optional(),
  extraActivities: z.array(z.string().trim().min(1).max(500)).optional(),
  city: z.string().trim().max(80).optional(),
  phone: z.string().trim().min(8).max(40).optional(),
  invitationMotivation: z.string().trim().max(2000).optional(),
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
  const patch = { ...parsed.data };
  const completeHint =
    Boolean(patch.company?.trim()) ||
    Boolean(patch.linkedinUrl?.trim()) ||
    Boolean(patch.city?.trim()) ||
    Boolean(patch.invitationMotivation?.trim());

  const nextProfileComplete =
    completeHint && profile.profileComplete === false ? true : profile.profileComplete;

  await db.collection(COLLECTIONS.waitlist).doc(profile.id).set(
    {
      ...patch,
      updatedAt: new Date().toISOString(),
      uid: user.uid,
      ...(completeHint && profile.profileComplete === false
        ? { profileComplete: true }
        : {}),
    },
    { merge: true },
  );

  const merged = {
    ...profile,
    ...patch,
    profileComplete: nextProfileComplete,
  };
  const sync = await syncWaitlistMemberToDatabasePerso(merged, "[me/profile]");
  if (sync.id) {
    await db.collection(COLLECTIONS.waitlist).doc(profile.id).set(
      {
        databasePersoContactId: sync.id,
        databasePersoSyncedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

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

  await db.collection(COLLECTIONS.waitlist).doc(profile.id).set(
    {
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return NextResponse.json({
    ok: true,
    softDeletedProfileId: profile.id,
  });
}
