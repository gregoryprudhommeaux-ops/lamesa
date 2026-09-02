import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: true, respondents: [], dev: true });
  }

  const { id: eventId } = await params;
  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection(COLLECTIONS.respondents)
      .where("eventId", "==", eventId)
      .limit(500)
      .get();

    const respondents = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aAt = String((a as { updatedAt?: string; createdAt?: string }).updatedAt
          ?? (a as { createdAt?: string }).createdAt
          ?? "");
        const bAt = String((b as { updatedAt?: string; createdAt?: string }).updatedAt
          ?? (b as { createdAt?: string }).createdAt
          ?? "");
        return bAt.localeCompare(aAt);
      });

    return NextResponse.json({ ok: true, respondents });
  } catch (error) {
    console.error("[admin/events interest-responses GET]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}
