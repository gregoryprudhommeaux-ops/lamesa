import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import {
  DEFAULT_OPS_PRIORITY,
  OPS_PRIORITIES,
  normalizeOpsTags,
} from "@/lib/constants/ops-priority";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    opsNotes: z.string().trim().max(4000).optional(),
    opsPriority: z.enum(OPS_PRIORITIES).optional(),
    opsTags: z.array(z.string()).max(12).optional(),
  })
  .strict();

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

/** Patch ops fields (notes / priority / tags) — admin cockpit. */
export async function PATCH(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
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

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ ok: false, error: "empty_patch" }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const ref = db.collection(COLLECTIONS.waitlist).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    if (isSoftDeleted(snap.data() as { deletedAt?: string | null })) {
      return NextResponse.json({ ok: false, error: "deleted" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      updatedAt: now,
      opsTouchedAt: now,
    };
    if (parsed.data.opsNotes !== undefined) {
      patch.opsNotes = parsed.data.opsNotes;
    }
    if (parsed.data.opsPriority !== undefined) {
      patch.opsPriority = parsed.data.opsPriority ?? DEFAULT_OPS_PRIORITY;
    }
    if (parsed.data.opsTags !== undefined) {
      patch.opsTags = normalizeOpsTags(parsed.data.opsTags);
    }

    await ref.set(patch, { merge: true });

    return NextResponse.json({
      ok: true,
      id,
      opsNotes: patch.opsNotes,
      opsPriority: patch.opsPriority,
      opsTags: patch.opsTags,
      opsTouchedAt: now,
    });
  } catch (error) {
    console.error("[admin/waitlist PATCH]", error);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }
}
