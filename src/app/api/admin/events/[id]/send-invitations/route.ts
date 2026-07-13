import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { applyInviteTemplateVars } from "@/lib/email/build-event-invite-template";
import { sendEventInvitationEmail } from "@/lib/email/send-event-invitation";
import { eventPublicUrl } from "@/lib/events/utils";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { z } from "zod";

const sendSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(20).max(20000),
  includeWaitlist: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://127.0.0.1:3000";
}

export async function POST(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id: eventId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const eventSnap = await db.collection(COLLECTIONS.events).doc(eventId).get();
  if (!eventSnap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const event = { id: eventSnap.id, ...(eventSnap.data() as Omit<AdminEvent, "id">) };
  const lang = event.eventLanguage ?? "fr";
  const eventUrl = eventPublicUrl(siteUrl(), event.slug, lang);

  const partsSnap = await db
    .collection(COLLECTIONS.participations)
    .where("eventId", "==", eventId)
    .get();

  const allowed = new Set(
    parsed.data.includeWaitlist ? ["invited", "waitlist"] : ["invited"],
  );

  const recipients = partsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AdminEventParticipation, "id">) }))
    .filter((p) => allowed.has(String(p.status ?? "")))
    .map((p) => ({
      email: normalizeEmail(String(p.email ?? "")),
      fullName: p.fullName ? String(p.fullName) : "",
    }))
    .filter((p) => p.email.includes("@"));

  // de-dupe by email
  const unique = new Map<string, { email: string; fullName: string }>();
  for (const r of recipients) {
    if (!unique.has(r.email)) unique.set(r.email, r);
  }
  const list = [...unique.values()];

  if (list.length === 0) {
    return NextResponse.json({ ok: false, error: "no_recipients" }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const r of list) {
    const subject = applyInviteTemplateVars(parsed.data.subject, {
      fullName: r.fullName,
      email: r.email,
      eventUrl,
    });
    const bodyText = applyInviteTemplateVars(parsed.data.body, {
      fullName: r.fullName,
      email: r.email,
      eventUrl,
    });
    const result = await sendEventInvitationEmail({
      to: r.email,
      subject,
      bodyText,
    });
    if (result.ok) sent += 1;
    else {
      failed += 1;
      errors.push(`${r.email}:${result.error}`);
    }
  }

  const now = new Date().toISOString();
  await db.collection(COLLECTIONS.events).doc(eventId).set(
    {
      inviteEmailSubject: parsed.data.subject,
      inviteEmailBody: parsed.data.body,
      inviteEmailSentAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    recipientCount: list.length,
    errors: errors.slice(0, 10),
  });
}
