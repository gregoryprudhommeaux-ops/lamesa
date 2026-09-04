import { NextResponse } from "next/server";
import { isPlatformAdminEmail, normalizeEmail } from "@/lib/auth/platform-admin";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { normalizeReferralCode } from "@/lib/member/referral-code";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type { WaitlistRegistration } from "@/lib/types/events";

/**
 * Full waitlist scans for mixed-case legacy emails. Off by default on Blaze —
 * set FIRESTORE_LEGACY_SCAN=1 only if a known old row still uses non-normalized email.
 * When enabled, cap is small (covers current LA MESA volume).
 */
const LEGACY_SCAN_ENABLED = process.env.FIRESTORE_LEGACY_SCAN === "1";
const LEGACY_SCAN_LIMIT = 100;

async function legacyWaitlistScan(
  predicate: (data: Record<string, unknown>) => boolean,
): Promise<{ id: string; data: Omit<WaitlistRegistration, "id"> } | null> {
  if (!LEGACY_SCAN_ENABLED) return null;
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.waitlist)
    .orderBy("createdAt", "desc")
    .limit(LEGACY_SCAN_LIMIT)
    .get();
  const hit = snap.docs.find((d) => predicate(d.data() as Record<string, unknown>));
  if (!hit) return null;
  return { id: hit.id, data: hit.data() as Omit<WaitlistRegistration, "id"> };
}

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
    if (!isSoftDeleted(data)) return { id: d.id, ...data };
  }

  const legacy = await legacyWaitlistScan((row) => {
    if (normalizeEmail(String(row.email ?? "")) !== target) return false;
    return !isSoftDeleted(row as Omit<WaitlistRegistration, "id">);
  });
  if (!legacy) return null;
  return { id: legacy.id, ...legacy.data };
}

export async function findWaitlistByEmailIncludingDeleted(
  email: string,
): Promise<(WaitlistRegistration & { id: string; uid?: string; linkedAt?: string }) | null> {
  if (!isFirebaseAdminConfigured()) return null;
  const db = getAdminFirestore();
  const target = normalizeEmail(email);

  const exact = await db.collection(COLLECTIONS.waitlist).where("email", "==", target).limit(1).get();
  if (!exact.empty) {
    const d = exact.docs[0]!;
    return { id: d.id, ...(d.data() as Omit<WaitlistRegistration, "id">) };
  }

  const legacy = await legacyWaitlistScan(
    (row) => normalizeEmail(String(row.email ?? "")) === target,
  );
  if (!legacy) return null;
  return { id: legacy.id, ...legacy.data };
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

  if (!exact.empty) {
    const hit = exact.docs[0]!;
    const data = hit.data() as Omit<WaitlistRegistration, "id">;
    if (isSoftDeleted(data)) return null;
    if (isPlatformAdminEmail(data.email)) return null;
    return { id: hit.id, ...data };
  }

  const legacy = await legacyWaitlistScan(
    (row) => normalizeReferralCode(String(row.referralCode ?? "")) === normalized,
  );
  if (!legacy) return null;
  if (isSoftDeleted(legacy.data)) return null;
  if (isPlatformAdminEmail(legacy.data.email)) return null;
  return { id: legacy.id, ...legacy.data };
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
