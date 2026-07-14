import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";

type Params = { params: Promise<{ id: string }> };

/** Soft-delete a waitlist contact (admin). */
export async function DELETE(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const ref = db.collection(COLLECTIONS.waitlist).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const data = snap.data() as { deletedAt?: string | null };
    if (isSoftDeleted(data)) {
      return NextResponse.json({ ok: true, id, alreadyDeleted: true });
    }

    const now = new Date().toISOString();
    await ref.set({ deletedAt: now, updatedAt: now }, { merge: true });

    return NextResponse.json({ ok: true, id, deletedAt: now });
  } catch (error) {
    console.error("[admin/waitlist DELETE]", error);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 502 });
  }
}
