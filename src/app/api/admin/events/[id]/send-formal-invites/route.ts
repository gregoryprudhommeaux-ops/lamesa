import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { sendCalendarInviteEmail } from "@/lib/email/send-calendar-invite";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { listFormalInviteRecipients } from "@/lib/events/formal-invite-recipients";
import { ensureOrganizerParticipation } from "@/lib/events/ensure-organizer-participation";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { ensureWaitlistProfileByEmail } from "@/lib/member/ensure-waitlist-for-auth";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const sendSchema = z.object({
  /** Limit send to these emails (normalized). Empty / omitted = all OUI not yet invited. */
  emails: z.array(z.string().email()).max(200).optional(),
  /** If true, also re-send to people who already got calendarInviteSentAt. */
  resend: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export async function GET(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id: eventId } = await params;
  const db = getAdminFirestore();
  const eventSnap = await db.collection(COLLECTIONS.events).doc(eventId).get();
  if (!eventSnap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const event = { id: eventSnap.id, ...(eventSnap.data() as Omit<AdminEvent, "id">) };
  const slug = String(event.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
  }

  const recipients = await listFormalInviteRecipients({ eventId, eventSlug: slug });
  const pending = recipients.filter((r) => !r.calendarInviteSentAt);
  const sent = recipients.filter((r) => Boolean(r.calendarInviteSentAt));

  return NextResponse.json({
    ok: true,
    eventId,
    eventSlug: slug,
    responseMode: event.responseMode ?? "rsvp",
    count: recipients.length,
    pendingCount: pending.length,
    sentCount: sent.length,
    recipients,
  });
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
    body = {};
  }
  const parsed = sendSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const eventSnap = await db.collection(COLLECTIONS.events).doc(eventId).get();
  if (!eventSnap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const event = { id: eventSnap.id, ...(eventSnap.data() as Omit<AdminEvent, "id">) };
  const slug = String(event.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
  }

  const allOui = await listFormalInviteRecipients({ eventId, eventSlug: slug });
  const emailFilter = parsed.data.emails?.length
    ? new Set(parsed.data.emails.map((e) => normalizeEmail(e)))
    : null;

  let targets = allOui.filter((r) => {
    if (emailFilter && !emailFilter.has(r.email)) return false;
    if (!parsed.data.resend && r.calendarInviteSentAt) return false;
    return true;
  });

  if (targets.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "no_recipients",
      detail: "Aucun OUI à inviter (déjà envoyé ou liste vide).",
    }, { status: 400 });
  }

  if (parsed.data.dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      count: targets.length,
      recipients: targets,
    });
  }

  await ensureOrganizerParticipation(db, eventId);

  const now = new Date().toISOString();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const target of targets) {
    if (isOrganizerParticipation({ email: target.email })) {
      skipped += 1;
      continue;
    }

    let participationId = target.participationId;
    let participation: AdminEventParticipation | null = null;

    if (participationId) {
      const snap = await db.collection(COLLECTIONS.participations).doc(participationId).get();
      if (snap.exists) {
        participation = {
          id: snap.id,
          ...(snap.data() as Omit<AdminEventParticipation, "id">),
        };
      }
    }

    if (!participation) {
      const ensured = await ensureWaitlistProfileByEmail({
        email: target.email,
        fullName: target.fullName,
        company: target.company,
        phone: target.phone,
        source: "la-mesa-std-invite",
        locale: event.eventLanguage === "en" || event.eventLanguage === "es"
          ? event.eventLanguage
          : "fr",
      });

      const ref = await db.collection(COLLECTIONS.participations).add({
        eventId,
        email: target.email,
        fullName: target.fullName || ensured?.fullName || target.email,
        companyName: target.company || ensured?.company || "",
        phone: target.phone || ensured?.phone || "",
        ...(ensured?.id ? { contactId: ensured.id } : {}),
        status: "invited",
        statusSource: "admin",
        createdAt: now,
        updatedAt: now,
      });
      participationId = ref.id;
      participation = {
        id: ref.id,
        eventId,
        email: target.email,
        fullName: target.fullName || ensured?.fullName || target.email,
        companyName: target.company || ensured?.company || "",
        phone: target.phone || ensured?.phone || "",
        ...(ensured?.id ? { contactId: ensured.id } : {}),
        status: "invited",
        statusSource: "admin",
        createdAt: now,
        updatedAt: now,
      };
    } else {
      const status = normalizeParticipationStatus(participation.status);
      if (status === "waitlist") {
        await db.collection(COLLECTIONS.participations).doc(participation.id).set(
          { status: "invited", updatedAt: now },
          { merge: true },
        );
        participation = { ...participation, status: "invited" };
      }
    }

    if (!participation) {
      failed += 1;
      errors.push(`${target.email}:missing_participation`);
      continue;
    }

    const result = await sendCalendarInviteEmail({
      event,
      participation,
    });
    if ("skipped" in result && result.skipped) {
      skipped += 1;
      continue;
    }
    if (!result.ok) {
      failed += 1;
      errors.push(`${target.email}:${result.error}`);
      continue;
    }

    sent += 1;
    await db.collection(COLLECTIONS.participations).doc(participation.id).set(
      { calendarInviteSentAt: now, updatedAt: now },
      { merge: true },
    );
  }

  if (sent > 0) {
    await db.collection(COLLECTIONS.events).doc(eventId).set(
      { inviteEmailSentAt: now, updatedAt: now },
      { merge: true },
    );
  }

  return NextResponse.json({
    ok: failed === 0,
    sent,
    failed,
    skipped,
    targeted: targets.length,
    errors: errors.slice(0, 20),
  });
}
