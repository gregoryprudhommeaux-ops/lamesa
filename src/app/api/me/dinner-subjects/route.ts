import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import {
  findWaitlistByEmail,
  linkWaitlistUid,
  requireVerifiedUser,
} from "@/lib/auth/member.server";
import { isPlatformAdminIdentity } from "@/lib/auth/platform-admin";
import {
  buildDeclaredSubjectInterests,
  mergeSubjectInterests,
} from "@/lib/dinner-subjects/interests";
import { getDinnerSubjectsByIds } from "@/lib/dinner-subjects/store";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  computeProfileCompletionPercent,
  isProfileIncomplete,
} from "@/lib/member/profile-completion";

function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

const patchSchema = z.object({
  dinnerSubjectIds: z.array(z.string().trim().min(1).max(80)).max(12),
});

/**
 * Save catalog subject interests — requires logged-in waitlist member with 100% profile.
 */
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

  if (isProfileIncomplete(profile)) {
    return NextResponse.json(
      {
        ok: false,
        error: "profile_incomplete",
        completionPercent: computeProfileCompletionPercent(profile),
      },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const catalog = await getDinnerSubjectsByIds(parsed.data.dinnerSubjectIds);
  const declared = buildDeclaredSubjectInterests(parsed.data.dinnerSubjectIds, catalog, now);
  const dinnerSubjectInterests = mergeSubjectInterests(
    profile.dinnerSubjectInterests,
    declared,
  );

  const db = getAdminFirestore();
  await db.collection(COLLECTIONS.waitlist).doc(profile.id).set(
    {
      dinnerSubjectInterests,
      updatedAt: now,
      uid: user.uid,
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true, dinnerSubjectInterests });
}
