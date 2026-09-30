import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import {
  buildInterestDisplayByEmail,
  type InterestDisplayStatus,
} from "@/lib/admin/interest-display";
import { computeInterestRsvpEmailSets } from "@/lib/admin/next-event-rsvp";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { listProspects } from "@/lib/prospects/store";
import type { AdminEvent, AdminEventParticipation, EventRespondent } from "@/lib/types/events";

type Params = { params: Promise<{ id: string }> };

/**
 * Email → interest display status for Audience/roster bridge.
 * Same buckets as dashboard STD (CRM playlists + formulaire enrichi).
 */
export async function GET(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: true, byEmail: {}, counts: {}, dev: true });
  }

  const { id: eventId } = await params;
  try {
    const db = getAdminFirestore();
    const eventSnap = await db.collection(COLLECTIONS.events).doc(eventId).get();
    if (!eventSnap.exists) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const event = { id: eventSnap.id, ...(eventSnap.data() as Omit<AdminEvent, "id">) };
    if (event.responseMode !== "interest") {
      return NextResponse.json({
        ok: true,
        byEmail: {} as Record<string, InterestDisplayStatus>,
        counts: { oui: 0, non: 0, autre: 0, sans_reponse: 0 },
        interestMode: false,
      });
    }

    const [respondentsSnap, partsSnap, prospects] = await Promise.all([
      db.collection(COLLECTIONS.respondents).where("eventId", "==", eventId).limit(500).get(),
      db.collection(COLLECTIONS.participations).where("eventId", "==", eventId).limit(500).get(),
      listProspects({ limit: 3000 }),
    ]);

    const respondents = respondentsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<EventRespondent, "id">),
    }));
    const parts = partsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdminEventParticipation, "id">),
    }));
    const contactedParticipationEmails = parts
      .filter((p) => Boolean(p.saveTheDateSentAt))
      .map((p) => String(p.email ?? "").trim().toLowerCase())
      .filter((e) => e.includes("@"));

    const sets = computeInterestRsvpEmailSets({
      eventSlug: event.slug,
      eventId,
      respondents,
      prospects,
      contactedParticipationEmails,
    });
    const map = buildInterestDisplayByEmail(sets);
    const byEmail: Record<string, InterestDisplayStatus> = {};
    const counts = { oui: 0, non: 0, autre: 0, sans_reponse: 0 };
    for (const [email, status] of map) {
      byEmail[email] = status;
      counts[status] += 1;
    }

    return NextResponse.json({
      ok: true,
      interestMode: true,
      byEmail,
      counts,
    });
  } catch (error) {
    console.error("[admin/events interest-status GET]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}
