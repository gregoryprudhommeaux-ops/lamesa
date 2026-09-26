import { NextResponse } from "next/server";
import { recordLastEmailCampaign } from "@/lib/admin/last-email-campaign";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { sendStdRelanceEmail } from "@/lib/email/send-std-relance";
import { templateLabel } from "@/lib/email/template-defaults";
import { interestSansReponseListName } from "@/lib/events/interest-prospect-lists";
import { isEligibleForStdPipelineCampaign } from "@/lib/events/std-contact-pipeline";
import {
  hasStdRelanceStamp,
  stdRelanceStampKey,
} from "@/lib/events/std-outreach-templates";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { markProspectsContacted, listProspects } from "@/lib/prospects/store";
import type { AdminEvent } from "@/lib/types/events";

type Params = { params: Promise<{ id: string }> };

/**
 * One STD follow-up from Qualification, to the event’s « SANS RÉPONSE » playlist.
 * Skips anyone already stamped `std_relance:{slug}`.
 */
export async function POST(request: Request, { params }: Params) {
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

  const listName = interestSansReponseListName(slug);
  const stamp = stdRelanceStampKey(slug);
  const prospects = await listProspects({ list: listName, limit: 500 });
  const withEmail = prospects.filter((p) => p.email.includes("@"));
  const alreadySent = withEmail.filter((p) => hasStdRelanceStamp(p.sentTemplateKeys, slug));
  const targets = withEmail.filter(
    (p) =>
      !hasStdRelanceStamp(p.sentTemplateKeys, slug) &&
      isEligibleForStdPipelineCampaign(p, stamp),
  );

  if (withEmail.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_recipients",
        detail: `Personne dans « ${listName} ».`,
      },
      { status: 400 },
    );
  }

  if (targets.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      failed: 0,
      skipped: 0,
      alreadySent: alreadySent.length,
      listName,
    });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const succeededIds: string[] = [];
  const succeededEmails: string[] = [];

  for (const prospect of targets) {
    const result = await sendStdRelanceEmail({
      event,
      email: prospect.email,
      fullName: prospect.fullName,
    });
    if ("skipped" in result && result.skipped) {
      skipped += 1;
      continue;
    }
    if (!result.ok) {
      failed += 1;
      errors.push(`${prospect.email}:${result.error}`);
      continue;
    }
    sent += 1;
    succeededIds.push(prospect.id);
    succeededEmails.push(prospect.email);
    void import("@/lib/contacts/activities-store").then(({ recordContactActivity }) =>
      recordContactActivity({
        email: prospect.email,
        type: "email_sent",
        source: "admin",
        summary: `Relance STD · ${event.title || slug}`,
        refs: { prospectId: prospect.id, templateKey: stamp, eventId: event.id },
      }),
    );
  }

  if (succeededIds.length > 0) {
    await markProspectsContacted(succeededIds, stamp);
    void recordLastEmailCampaign({
      templateKey: stamp,
      templateLabel: templateLabel("std_relance"),
      recipientEmails: succeededEmails,
      eventSlug: slug,
      eventId: event.id,
      eventTitle: event.title,
      source: "std_relance",
    });
  }

  return NextResponse.json({
    ok: failed === 0,
    sent,
    failed,
    skipped,
    alreadySent: alreadySent.length,
    listName,
    errors: errors.slice(0, 20),
  });
}
