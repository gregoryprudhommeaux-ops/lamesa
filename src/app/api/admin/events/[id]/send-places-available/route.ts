import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { sendPlacesAvailableEmail } from "@/lib/email/send-calendar-invite";
import {
  countSeatedParticipations,
  DEFAULT_GUEST_CAPACITY,
  isOrganizerParticipation,
  nextInviteStatus,
} from "@/lib/events/capacity";
import { ensureOrganizerParticipation } from "@/lib/events/ensure-organizer-participation";
import {
  listPlacesAvailableCandidates,
  type PlacesAvailableBucket,
} from "@/lib/events/places-available-candidates";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { findWaitlistByEmail } from "@/lib/auth/member.server";
import { recordLastEmailCampaign } from "@/lib/admin/last-email-campaign";
import { templateLabel } from "@/lib/email/template-defaults";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const sendSchema = z.object({
  emails: z.array(z.string().email()).max(500),
  /** Persist / override public neighborhood line for this blast. */
  publicAreaHint: z.string().trim().max(200).optional(),
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

  const url = new URL(request.url);
  const bucketRaw = (url.searchParams.get("bucket") ?? "eligible").trim() as PlacesAvailableBucket;
  const bucket: PlacesAvailableBucket =
    bucketRaw === "french" ||
    bucketRaw === "sans_reponse" ||
    bucketRaw === "oui" ||
    bucketRaw === "eligible"
      ? bucketRaw
      : "eligible";

  const all = await listPlacesAvailableCandidates({ eventId, eventSlug: slug });
  const recipients = all.filter((r) => r.buckets.includes(bucket));

  const counts = {
    eligible: all.filter((r) => r.buckets.includes("eligible")).length,
    french: all.filter((r) => r.buckets.includes("french")).length,
    sans_reponse: all.filter((r) => r.buckets.includes("sans_reponse")).length,
    oui: all.filter((r) => r.buckets.includes("oui")).length,
  };

  return NextResponse.json({
    ok: true,
    eventId,
    eventSlug: slug,
    bucket,
    counts,
    publicAreaHint: event.publicAreaHint ?? "",
    paymentDeadlineAt: event.paymentDeadlineAt ?? null,
    capacity:
      typeof event.capacity === "number" && event.capacity > 0
        ? event.capacity
        : DEFAULT_GUEST_CAPACITY,
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
  if (parsed.data.emails.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no_recipients", detail: "Sélectionne au moins un contact." },
      { status: 400 },
    );
  }

  const db = getAdminFirestore();
  const eventRef = db.collection(COLLECTIONS.events).doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  let event = { id: eventSnap.id, ...(eventSnap.data() as Omit<AdminEvent, "id">) };
  const slug = String(event.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
  }

  const now = new Date().toISOString();
  if (parsed.data.publicAreaHint?.trim()) {
    await eventRef.set(
      { publicAreaHint: parsed.data.publicAreaHint.trim(), updatedAt: now },
      { merge: true },
    );
    event = { ...event, publicAreaHint: parsed.data.publicAreaHint.trim() };
  }

  const candidates = await listPlacesAvailableCandidates({ eventId, eventSlug: slug });
  const byEmail = new Map(candidates.map((c) => [c.email, c]));
  const emailFilter = new Set(parsed.data.emails.map((e) => normalizeEmail(e)));

  const targets = [...emailFilter]
    .map((email) => byEmail.get(email))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  // Allow admin to force-add emails not in heuristic pool (manual paste later) — skip for now.
  if (targets.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_recipients",
        detail: "Aucun contact éligible dans la sélection (exclus : NON / payés / organisateur).",
      },
      { status: 400 },
    );
  }

  if (parsed.data.dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      count: targets.length,
      emails: targets.map((t) => t.email),
    });
  }

  await ensureOrganizerParticipation(db, eventId);

  const capacity =
    typeof event.capacity === "number" && event.capacity > 0
      ? event.capacity
      : DEFAULT_GUEST_CAPACITY;

  const existingPartsSnap = await db
    .collection(COLLECTIONS.participations)
    .where("eventId", "==", eventId)
    .limit(500)
    .get();
  const existingParts = existingPartsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<AdminEventParticipation, "id">),
  }));
  let seated = countSeatedParticipations(existingParts);
  const partsByEmail = new Map(
    existingParts.map((p) => [normalizeEmail(p.email), p] as const),
  );

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const sentEmails: string[] = [];

  for (const target of targets) {
    if (isOrganizerParticipation({ email: target.email })) {
      skipped += 1;
      continue;
    }
    if (!parsed.data.resend && target.placesAvailableSentAt) {
      skipped += 1;
      continue;
    }

    let participation = partsByEmail.get(target.email) ?? null;

    if (!participation) {
      // Never auto-create a waitlist "inscrit" — only link if they already signed up.
      const existingMember = await findWaitlistByEmail(target.email);

      const status = nextInviteStatus(capacity, seated);
      if (status === "invited") seated += 1;

      const ref = await db.collection(COLLECTIONS.participations).add({
        eventId,
        email: target.email,
        fullName: target.fullName || existingMember?.fullName || target.email,
        companyName: target.company || existingMember?.company || "",
        phone: target.phone || existingMember?.phone || "",
        ...(existingMember?.id ? { contactId: existingMember.id } : {}),
        status,
        statusSource: "admin",
        createdAt: now,
        updatedAt: now,
      });
      participation = {
        id: ref.id,
        eventId,
        email: target.email,
        fullName: target.fullName || existingMember?.fullName || target.email,
        status,
        statusSource: "admin",
      };
      partsByEmail.set(target.email, participation);
    }

    const result = await sendPlacesAvailableEmail({
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
    sentEmails.push(target.email);
    await db.collection(COLLECTIONS.participations).doc(participation.id).set(
      {
        placesAvailableSentAt: now,
        calendarInviteSentAt: participation.calendarInviteSentAt ?? now,
        updatedAt: now,
      },
      { merge: true },
    );
  }

  if (sentEmails.length > 0) {
    void recordLastEmailCampaign({
      templateKey: `places_available:${slug}`,
      templateLabel: templateLabel("places_available"),
      sentAt: now,
      recipientEmails: sentEmails,
      eventSlug: slug,
      eventId,
      eventTitle: event.title,
      source: "places_available",
    });
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
