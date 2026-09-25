import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  satisfactionSurveyAutoSend: z.boolean(),
});

/** Lightweight toggle — does not require the full event form payload. */
export async function PATCH(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.events).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  await ref.set(
    {
      satisfactionSurveyAutoSend: parsed.data.satisfactionSurveyAutoSend,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return NextResponse.json({
    ok: true,
    satisfactionSurveyAutoSend: parsed.data.satisfactionSurveyAutoSend,
  });
}
