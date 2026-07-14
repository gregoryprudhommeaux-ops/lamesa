import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import {
  computeEventSatisfaction,
  computeSatisfactionAverages,
  surveysFromParticipations,
} from "@/lib/admin/satisfaction-stats";
import { DEFAULT_GUEST_CAPACITY } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  try {
    const db = getAdminFirestore();
    const [eventsSnap, partsSnap, waitlistSnap] = await Promise.all([
      db.collection(COLLECTIONS.events).limit(300).get(),
      db.collection(COLLECTIONS.participations).limit(5000).get(),
      db.collection(COLLECTIONS.waitlist).limit(3000).get(),
    ]);

    const events = eventsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdminEvent, "id">),
    }));
    const participations = partsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdminEventParticipation, "id">),
    }));

    const waitlistActive = waitlistSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as { deletedAt?: string | null }) }))
      .filter((r) => !isSoftDeleted(r));

    const statusCounts = {
      invited: 0,
      attending: 0,
      confirmed: 0,
      not_attending: 0,
      waitlist: 0,
    };
    for (const p of participations) {
      const s = normalizeParticipationStatus(p.status);
      if (s in statusCounts) {
        statusCounts[s as keyof typeof statusCounts] += 1;
      }
    }

    const allSurveys = surveysFromParticipations(participations);
    const platformSatisfaction = computeSatisfactionAverages(allSurveys);

    const byEvent = events
      .map((ev) => {
        const parts = participations.filter((p) => p.eventId === ev.id);
        const sat = computeEventSatisfaction(parts);
        return {
          id: ev.id,
          title: ev.title,
          startsAt: ev.startsAt,
          status: ev.status ?? "draft",
          capacity: ev.capacity ?? DEFAULT_GUEST_CAPACITY,
          guests: parts.length,
          satisfaction: sat,
        };
      })
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

    const eventsWithSurvey = byEvent.filter((e) => e.satisfaction.responseCount > 0);
    const published = events.filter((e) => e.status === "published").length;
    const upcoming = events.filter((e) => new Date(e.startsAt).getTime() > Date.now()).length;

    return NextResponse.json({
      ok: true,
      kpis: {
        waitlistUsers: waitlistActive.length,
        eventsTotal: events.length,
        eventsPublished: published,
        eventsUpcoming: upcoming,
        participationsTotal: participations.length,
        confirmed: statusCounts.confirmed,
        attending: statusCounts.attending,
        invited: statusCounts.invited,
        waitlistSeats: statusCounts.waitlist,
        notAttending: statusCounts.not_attending,
        surveysResponses: platformSatisfaction.responseCount,
        eventsWithSurvey: eventsWithSurvey.length,
      },
      statusCounts,
      satisfaction: platformSatisfaction,
      events: byEvent,
    });
  } catch (error) {
    console.error("[admin/dashboard]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}
