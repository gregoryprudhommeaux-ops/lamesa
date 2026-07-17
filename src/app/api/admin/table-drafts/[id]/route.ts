import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import {
  normalizeTableDraft,
  tableDraftPatchSchema,
  validateMergedTableDraft,
} from "@/lib/admin/table-drafts";
import {
  COLLECTIONS,
  getAdminFirestore,
  isFirebaseAdminConfigured,
} from "@/lib/firebase/admin";

type Params = { params: Promise<{ id: string }> };

class DraftNotFoundError extends Error {}
class DraftValidationError extends Error {}

export async function PATCH(request: Request, { params }: Params) {
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

  const parsed = tableDraftPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const firestore = getAdminFirestore();
    const reference = firestore.collection(COLLECTIONS.tableDrafts).doc(id);
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new DraftNotFoundError();

      const rawCurrent = snapshot.data();
      const current = normalizeTableDraft(id, rawCurrent);
      const validated = validateMergedTableDraft(current, parsed.data, rawCurrent);
      if (!validated.ok) throw new DraftValidationError();

      const isArchiveTransition =
        parsed.data.status === "archived" && current.status !== "archived";
      transaction.update(reference, {
        ...parsed.data,
        ...(isArchiveTransition
          ? {}
          : {
              primary: validated.merged.primary,
              alternates: validated.merged.alternates,
            }),
        updatedAt: new Date().toISOString(),
      });
    });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (error instanceof DraftNotFoundError) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    if (error instanceof DraftValidationError) {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }
    console.error("[admin/table-drafts PATCH]", error);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;
  try {
    const firestore = getAdminFirestore();
    const reference = firestore.collection(COLLECTIONS.tableDrafts).doc(id);
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new DraftNotFoundError();
      transaction.update(reference, {
        status: "archived",
        updatedAt: new Date().toISOString(),
      });
    });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (error instanceof DraftNotFoundError) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    console.error("[admin/table-drafts DELETE]", error);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }
}
