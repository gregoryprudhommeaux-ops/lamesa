import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { z } from "zod";

const bodySchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(100),
});

/** Soft-delete multiple waitlist contacts (admin). */
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const db = getAdminFirestore();
  let deleted = 0;
  let skipped = 0;

  try {
    for (const id of parsed.data.ids) {
      const ref = db.collection(COLLECTIONS.waitlist).doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        skipped += 1;
        continue;
      }
      if (isSoftDeleted(snap.data() as { deletedAt?: string | null })) {
        skipped += 1;
        continue;
      }
      await ref.set({ deletedAt: now, updatedAt: now }, { merge: true });
      deleted += 1;
    }
    return NextResponse.json({ ok: true, deleted, skipped });
  } catch (error) {
    console.error("[admin/waitlist/bulk-delete]", error);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 502 });
  }
}
