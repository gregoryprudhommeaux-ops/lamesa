import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ ok: true, results: [], dev: true });
    }
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection(COLLECTIONS.waitlist)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const results = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...(data as Record<string, unknown>),
        referralCode: data.referralCode ?? null,
        referredByCode: data.referredByCode ?? null,
        referredById: data.referredById ?? null,
        deletedAt: data.deletedAt ?? null,
      };
    });

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("[waitlist]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}
