import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { findWaitlistByEmail } from "@/lib/auth/member.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { applyOuiEmailsToParticipations } from "@/lib/events/apply-interest-oui-to-participations";
import { listFormalInviteRecipients } from "@/lib/events/formal-invite-recipients";
import {
  ensureInterestProspectLists,
  interestProspectListNames,
  reconcileAnsweredStdProspectLists,
  syncInterestRespondentToProspectLists,
} from "@/lib/events/sync-interest-to-prospect-lists";
import { syncStdSansReponseList } from "@/lib/events/sync-std-sans-reponse-list";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { EventInterestResponse } from "@/lib/types/events";

type Params = { params: Promise<{ id: string }> };

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

  const event = eventSnap.data() ?? {};
  const slug = String(event.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
  }

  const lists = await ensureInterestProspectLists(slug);
  const snap = await db
    .collection(COLLECTIONS.respondents)
    .where("eventId", "==", eventId)
    .limit(500)
    .get();

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const email = normalizeEmail(String(data.email ?? ""));
    const interestResponse = data.interestResponse as EventInterestResponse | undefined;
    if (!email || (interestResponse !== "yes" && interestResponse !== "no" && interestResponse !== "other")) {
      skipped += 1;
      continue;
    }

    const waitlist = await findWaitlistByEmail(email);
    const fullName =
      waitlist?.fullName?.trim() ||
      `${String(data.firstName ?? "")} ${String(data.lastName ?? "")}`.trim() ||
      email;

    const result = await syncInterestRespondentToProspectLists({
      eventSlug: slug,
      email,
      fullName,
      company: waitlist?.company || String(data.companyName ?? ""),
      phone: waitlist?.phone || String(data.whatsapp ?? ""),
      position: waitlist?.position || String(data.jobTitle ?? ""),
      interestResponse,
      expectations: (data.expectations as string | null | undefined) ?? null,
      declineReason: (data.declineReason as string | null | undefined) ?? null,
      declineReasonOther: (data.declineReasonOther as string | null | undefined) ?? null,
      ideasComment: (data.ideasComment as string | null | undefined) ?? null,
      waitlist,
      logPrefix: "[interest-lists-backfill]",
    });

    if (result.ok) synced += 1;
    else if (result.skipped) skipped += 1;
    else failed += 1;
  }

  const reconciled = await reconcileAnsweredStdProspectLists(slug);
  const sansReponse = await syncStdSansReponseList({ eventSlug: slug, eventId });

  /** Vague 3 — OUI (form ∪ playlist) → Audience participations. */
  let audience = { create: 0, promote: 0, noop: 0 };
  try {
    const ouiRecipients = await listFormalInviteRecipients({ eventId, eventSlug: slug });
    audience = await applyOuiEmailsToParticipations({
      db,
      eventId,
      ouiEmails: ouiRecipients.map((r) => r.email),
    });
  } catch (error) {
    console.warn("[sync-interest-lists] audience OUI upsert failed", error);
  }

  return NextResponse.json({
    ok: true,
    lists: interestProspectListNames(slug),
    ensured: lists,
    scanned: snap.size,
    synced,
    failed,
    skipped,
    reconciled,
    sansReponse,
    audience,
  });
}
