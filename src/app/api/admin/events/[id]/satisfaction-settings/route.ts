import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { surveyLocaleFrom } from "@/lib/satisfaction/survey-copy";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const schema = z
  .object({
    satisfactionSurveyAutoSend: z.boolean().optional(),
    /** Mark survey language + questions as reviewed for this event. */
    validateContent: z.boolean().optional(),
    /** Locale used when validating (defaults to event language). */
    validatedLocale: z.enum(["es", "fr", "en"]).optional(),
  })
  .refine(
    (v) =>
      typeof v.satisfactionSurveyAutoSend === "boolean" || v.validateContent === true,
    { message: "empty" },
  );

/** Lightweight toggle / validation — does not require the full event form payload. */
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

  const eventLang = surveyLocaleFrom(
    parsed.data.validatedLocale ??
      (snap.data() as { eventLanguage?: string } | undefined)?.eventLanguage,
  );

  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (typeof parsed.data.satisfactionSurveyAutoSend === "boolean") {
    patch.satisfactionSurveyAutoSend = parsed.data.satisfactionSurveyAutoSend;
  }
  if (parsed.data.validateContent === true) {
    patch.satisfactionContentValidatedAt = new Date().toISOString();
    patch.satisfactionContentValidatedLocale = eventLang;
  }

  await ref.set(patch, { merge: true });

  return NextResponse.json({
    ok: true,
    satisfactionSurveyAutoSend:
      typeof parsed.data.satisfactionSurveyAutoSend === "boolean"
        ? parsed.data.satisfactionSurveyAutoSend
        : (snap.data() as { satisfactionSurveyAutoSend?: boolean })?.satisfactionSurveyAutoSend ===
          true,
    satisfactionContentValidatedAt: patch.satisfactionContentValidatedAt ?? null,
    satisfactionContentValidatedLocale: patch.satisfactionContentValidatedLocale ?? null,
  });
}
