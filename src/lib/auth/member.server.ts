import { NextResponse } from "next/server";
import { isPlatformAdminEmail, normalizeEmail } from "@/lib/auth/platform-admin";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { normalizeReferralCode } from "@/lib/member/referral-code";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type { WaitlistRegistration } from "@/lib/types/events";

export async function findWaitlistByEmail(
  email: string,
): Promise<(WaitlistRegistration & { id: string; uid?: string; linkedAt?: string }) | null> {
  if (!isFirebaseAdminConfigured()) return null;
  const db = getAdminFirestore();
  const target = normalizeEmail(email);

  const exact = await db.collection(COLLECTIONS.waitlist).where("email", "==", target).limit(1).get();
  if (!exact.empty) {
    const d = exact.docs[0]!;
    const data = d.data() as Omit<WaitlistRegistration, "id">;
    if (isSoftDeleted(data)) return null;
    return { id: d.id, ...data };
  }

  // Legacy rows may have mixed-case emails
  const snap = await db.collection(COLLECTIONS.waitlist).orderBy("createdAt", "desc").limit(400).get();
  const hit = snap.docs.find((d) => normalizeEmail(String(d.data().email ?? "")) === target);
  if (!hit) return null;
  const data = hit.data() as Omit<WaitlistRegistration, "id">;
  if (isSoftDeleted(data)) return null;
  return { id: hit.id, ...data };
}

export async function findWaitlistByReferralCode(
  code: string,
): Promise<(WaitlistRegistration & { id: string }) | null> {
  if (!isFirebaseAdminConfigured()) return null;
  const db = getAdminFirestore();
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;

  const exact = await db
    .collection(COLLECTIONS.waitlist)
    .where("referralCode", "==", normalized)
    .limit(1)
    .get();

  let hit = exact.empty ? null : exact.docs[0]!;

  if (!hit) {
    const snap = await db.collection(COLLECTIONS.waitlist).orderBy("createdAt", "desc").limit(400).get();
    hit =
      snap.docs.find(
        (d) => normalizeReferralCode(String(d.data().referralCode ?? "")) === normalized,
      ) ?? null;
  }

  if (!hit) return null;

  const data = hit.data() as Omit<WaitlistRegistration, "id">;
  if (isSoftDeleted(data)) return null;
  if (isPlatformAdminEmail(data.email)) return null;

  return { id: hit.id, ...data };
}

export async function linkWaitlistUid(waitlistId: string, uid: string): Promise<void> {
  if (!isFirebaseAdminConfigured()) return;
  const db = getAdminFirestore();
  await db.collection(COLLECTIONS.waitlist).doc(waitlistId).set(
    { uid, linkedAt: new Date().toISOString() },
    { merge: true },
  );
}

export async function requireVerifiedUser(request: Request) {
  const { verifyBearerUser } = await import("@/lib/auth/verify-bearer");
  const user = await verifyBearerUser(request);
  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return user;
}
