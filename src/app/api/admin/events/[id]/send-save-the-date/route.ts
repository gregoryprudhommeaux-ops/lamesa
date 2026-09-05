import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { sendSaveTheDateEmail } from "@/lib/email/send-save-the-date";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { ensureWaitlistProfileByEmail } from "@/lib/member/ensure-waitlist-for-auth";
import {
  findProspectByEmail,
  updateProspect,
  upsertProspect,
} from "@/lib/prospects/store";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { z } from "zod";

const sendSchema = z.object({
  participationIds: z.array(z.string().min(1)).optional(),
});

type Params = { params: Promise<{ id: string }> };

/** Mark STD recipients as Sans réponse unless already won / DNC. */
async function markProspectNoResponse(input: {
  email: string;
  fullName?: string | null;
  company?: string | null;
  phone?: string | null;
  eventSlug: string;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  if (!email.includes("@")) return;
  const existing = await findProspectByEmail(email);
  if (existing?.status === "won" || existing?.status === "do_not_contact") return;
  if (existing) {
    await updateProspect(existing.id, { status: "no_response" });
    return;
  }
  await upsertProspect(
    {
      email,
      fullName: input.fullName ?? undefined,
      company: input.company ?? undefined,
      phone: input.phone ?? undefined,
      status: "no_response",
      tags: ["save-the-date"],
      source: `std:${input.eventSlug}`,
    },
    { source: `std:${input.eventSlug}` },
  );
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
  const locale =
    event.eventLanguage === "en" || event.eventLanguage === "es" ? event.eventLanguage : "fr";

  const partsSnap = await db
    .collection(COLLECTIONS.participations)
    .where("eventId", "==", eventId)
    .get();

  const idFilter = parsed.data.participationIds?.length
    ? new Set(parsed.data.participationIds)
    : null;

  const recipients = partsSnap.docs
    .map((d) => {
      const p = { id: d.id, ...(d.data() as Omit<AdminEventParticipation, "id">) };
      return { ...p, status: normalizeParticipationStatus(p.status) };
    })
    .filter((p) => (idFilter ? idFilter.has(p.id) : true))
    .filter((p) => !isOrganizerParticipation(p))
    .filter((p) => p.status === "invited" || p.status === "waitlist")
    .filter((p) => String(p.email ?? "").includes("@"));

  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "no_recipients" }, { status: 400 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let waitlistProvisioned = 0;
  const errors: string[] = [];

  for (const participation of recipients) {
    const email = normalizeEmail(participation.email);
    const ensured = await ensureWaitlistProfileByEmail({
      email,
      fullName: participation.fullName,
      company: participation.companyName,
      phone: participation.phone,
      locale,
      source: "la-mesa-std-invite",
    });

    if (ensured?.provisioned || ensured?.revived) {
      waitlistProvisioned += 1;
    }

    if (ensured && (!participation.contactId || participation.contactId !== ensured.id)) {
      await db.collection(COLLECTIONS.participations).doc(participation.id).set(
        {
          contactId: ensured.id,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }

    const result = await sendSaveTheDateEmail({ event, participation });
    if ("skipped" in result && result.skipped) {
      skipped += 1;
      continue;
    }
    if (!result.ok) {
      failed += 1;
      errors.push(`${participation.email}: ${result.error}`);
      continue;
    }
    sent += 1;
    await db.collection(COLLECTIONS.participations).doc(participation.id).set(
      {
        saveTheDateSentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    void markProspectNoResponse({
      email,
      fullName: participation.fullName ?? ensured?.fullName,
      company: participation.companyName ?? ensured?.company,
      phone: participation.phone ?? ensured?.phone,
      eventSlug: event.slug,
    }).catch((err) => {
      console.warn("[send-save-the-date] prospect no_response failed", email, err);
    });
  }

  await db.collection(COLLECTIONS.events).doc(eventId).set(
    {
      saveTheDateSentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return NextResponse.json({
    ok: failed === 0,
    sent,
    skipped,
    failed,
    waitlistProvisioned,
    errors: errors.slice(0, 20),
  });
}
