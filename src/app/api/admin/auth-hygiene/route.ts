import { getAuth } from "firebase-admin/auth";
import { getApps } from "firebase-admin/app";
import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { isPlatformAdminEmail, normalizeEmail } from "@/lib/auth/platform-admin";
import { findWaitlistByEmail } from "@/lib/auth/member.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";

const AUTH_PAGE_SIZE = 1000;
const AUTH_MAX_USERS = 1000;
const WAITLIST_SCAN_LIMIT = 500;
const LOOKUP_CONCURRENCY = 25;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

/** Admin hygiene: Auth users missing waitlist + waitlist members missing Auth uid. */
export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  try {
    getAdminFirestore();
    const auth = getAuth(getApps()[0]!);

    const authUsers: Array<{
      uid: string;
      email: string;
      displayName: string | null;
      providers: string[];
      createdAt: string | null;
    }> = [];

    let pageToken: string | undefined;
    do {
      const page = await auth.listUsers(AUTH_PAGE_SIZE, pageToken);
      for (const u of page.users) {
        const email = normalizeEmail(u.email ?? "");
        if (!email.includes("@")) continue;
        if (isPlatformAdminEmail(email)) continue;
        authUsers.push({
          uid: u.uid,
          email,
          displayName: u.displayName?.trim() || null,
          providers: (u.providerData ?? []).map((p) => p.providerId).filter(Boolean),
          createdAt: u.metadata.creationTime
            ? new Date(u.metadata.creationTime).toISOString()
            : null,
        });
        if (authUsers.length >= AUTH_MAX_USERS) break;
      }
      pageToken =
        authUsers.length >= AUTH_MAX_USERS ? undefined : page.pageToken || undefined;
    } while (pageToken);

    const checks = await mapPool(authUsers, LOOKUP_CONCURRENCY, async (u) => {
      const profile = await findWaitlistByEmail(u.email);
      return { u, hasProfile: Boolean(profile) };
    });

    const authWithoutProfile = checks
      .filter((c) => !c.hasProfile)
      .map((c) => c.u)
      .sort((a, b) => a.email.localeCompare(b.email));

    const waitlistSnap = await getAdminFirestore()
      .collection(COLLECTIONS.waitlist)
      .orderBy("createdAt", "desc")
      .limit(WAITLIST_SCAN_LIMIT)
      .get();

    const waitlistWithoutAuth = waitlistSnap.docs
      .map((d) => {
        const data = d.data() as {
          email?: string;
          fullName?: string;
          uid?: string;
          deletedAt?: string | null;
        };
        return {
          id: d.id,
          email: normalizeEmail(String(data.email ?? "")),
          fullName: data.fullName?.trim() || null,
          uid: data.uid?.trim() || null,
          deletedAt: data.deletedAt ?? null,
        };
      })
      .filter((r) => r.email.includes("@") && !isSoftDeleted(r) && !r.uid)
      .map(({ id, email, fullName }) => ({ id, email, fullName }));

    return NextResponse.json({
      ok: true,
      authWithoutProfile,
      waitlistWithoutAuth,
      authScanned: authUsers.length,
      waitlistScanned: waitlistSnap.size,
      waitlistScanCapped: waitlistSnap.size >= WAITLIST_SCAN_LIMIT,
    });
  } catch (error) {
    console.error("[admin/auth-hygiene]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}
