import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import {
  buildProfileIncompletePreview,
  sendProfileIncompleteEmail,
} from "@/lib/email/send-profile-incomplete";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isProfileIncomplete } from "@/lib/member/profile-completion";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type { WaitlistRegistration } from "@/lib/types/events";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    force: z.boolean().optional(),
    subject: z.string().min(1).max(300).optional(),
    body: z.string().min(1).max(20_000).optional(),
  })
  .strict()
  .optional();

async function loadMember(id: string): Promise<
  | { ok: true; member: WaitlistRegistration }
  | { ok: false; status: number; error: string }
> {
  if (!id?.trim()) {
    return { ok: false, status: 400, error: "invalid_id" };
  }
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.waitlist).doc(id).get();
  if (!snap.exists) {
    return { ok: false, status: 404, error: "not_found" };
  }
  const member = { id: snap.id, ...(snap.data() as Omit<WaitlistRegistration, "id">) };
  if (isSoftDeleted(member)) {
    return { ok: false, status: 409, error: "deleted" };
  }
  if (!isProfileIncomplete(member)) {
    return { ok: false, status: 400, error: "profile_complete" };
  }
  if (!member.email?.trim()) {
    return { ok: false, status: 400, error: "missing_email" };
  }
  return { ok: true, member };
}

/** Preview profile-incomplete nudge (subject + body) without sending. */
export async function GET(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;
  try {
    const loaded = await loadMember(id);
    if (!loaded.ok) {
      return NextResponse.json({ ok: false, error: loaded.error }, { status: loaded.status });
    }

    const result = await buildProfileIncompletePreview({ member: loaded.member });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      preview: result.preview,
      alreadySentThisMonth:
        loaded.member.profileIncompleteNudgeMonth === result.preview.month,
    });
  } catch (error) {
    console.error("[admin/waitlist preview-profile-incomplete]", error);
    return NextResponse.json({ ok: false, error: "preview_failed" }, { status: 502 });
  }
}

/** Send profile-incomplete nudge (ES) to one waitlist member. */
export async function POST(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;

  let force = false;
  let subject: string | undefined;
  let body: string | undefined;
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (parsed.success && parsed.data) {
      if (parsed.data.force) force = true;
      subject = parsed.data.subject?.trim();
      body = parsed.data.body?.trim();
    }
  } catch {
    // empty body ok
  }

  if ((subject && !body) || (!subject && body)) {
    return NextResponse.json(
      { ok: false, error: "subject_and_body_required_together" },
      { status: 400 },
    );
  }

  try {
    const loaded = await loadMember(id);
    if (!loaded.ok) {
      return NextResponse.json({ ok: false, error: loaded.error }, { status: loaded.status });
    }

    const result = await sendProfileIncompleteEmail({
      member: loaded.member,
      force,
      subject,
      body,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, status: "failed" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      skipped: Boolean(result.skipped),
      reason: "reason" in result ? result.reason : undefined,
      month: "month" in result ? result.month : undefined,
      profileIncompleteEmailStatus: result.skipped ? "skipped" : "sent",
    });
  } catch (error) {
    console.error("[admin/waitlist send-profile-incomplete]", error);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }
}
