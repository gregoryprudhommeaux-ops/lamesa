import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { sendFranconetworkAnnouncementEmail } from "@/lib/email/send-fn-announcement";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isFranconetworkMember } from "@/lib/member/franconetwork-member";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type { WaitlistRegistration } from "@/lib/types/events";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    force: z.boolean().optional(),
  })
  .strict()
  .optional();

/** Send FrancoNetwork announcement email (ES) to one waitlist member. */
export async function POST(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  let force = false;
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (parsed.success && parsed.data?.force) force = true;
  } catch {
    // empty body ok
  }

  try {
    const db = getAdminFirestore();
    const snap = await db.collection(COLLECTIONS.waitlist).doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const member = { id: snap.id, ...(snap.data() as Omit<WaitlistRegistration, "id">) };
    if (isSoftDeleted(member)) {
      return NextResponse.json({ ok: false, error: "deleted" }, { status: 409 });
    }
    if (!isFranconetworkMember(member)) {
      return NextResponse.json({ ok: false, error: "not_franconetwork" }, { status: 400 });
    }
    if (!member.email?.trim()) {
      return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });
    }

    const alreadySent = member.fnAnnouncementEmailStatus === "sent";
    const result = await sendFranconetworkAnnouncementEmail({
      to: member.email.trim(),
      fullName: member.fullName ?? "",
      waitlistId: member.id,
      force,
      alreadySent,
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
      fnAnnouncementEmailStatus: result.skipped ? "skipped" : "sent",
    });
  } catch (error) {
    console.error("[admin/waitlist send-fn-announcement]", error);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }
}
