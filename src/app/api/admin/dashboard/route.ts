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
import { buildMemberEngagementIndex } from "@/lib/admin/member-engagement";
import {
  computeProfileCompletionPercent,
  isExpressSignup,
  listMissingProfileFieldsFr,
} from "@/lib/member/profile-completion";
import { listRecentTableDraftSummaries } from "@/lib/admin/table-drafts";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type {
  AdminEvent,
  AdminEventParticipation,
  WaitlistRegistration,
} from "@/lib/types/events";

const RECENT_REGISTRANTS_LIMIT = 25;

function normalizeDistributionValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "__missing__";
}

function buildDistribution(
  rows: WaitlistRegistration[],
  field: "sector" | "position" | "city",
): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeDistributionValue(row[field]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "fr"));
}

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  try {
    const db = getAdminFirestore();
    const draftsPromise = db
      .collection(COLLECTIONS.tableDrafts)
      .get()
      .catch((error) => {
        console.error("[admin/dashboard drafts]", error);
        return null;
      });
    const [eventsSnap, partsSnap, waitlistSnap, draftsSnap] = await Promise.all([
      db.collection(COLLECTIONS.events).limit(300).get(),
      db.collection(COLLECTIONS.participations).limit(5000).get(),
      db.collection(COLLECTIONS.waitlist).limit(3000).get(),
      draftsPromise,
    ]);

    const events = eventsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdminEvent, "id">),
    }));
    const participations = partsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdminEventParticipation, "id">),
    }));

    const waitlistAll = waitlistSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<WaitlistRegistration, "id">),
    }));
    const waitlistActive = waitlistAll.filter((r) => !isSoftDeleted(r));

    const recentMembers = [...waitlistActive]
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      )
      .slice(0, RECENT_REGISTRANTS_LIMIT);

    const engagementByMember = buildMemberEngagementIndex({
      members: recentMembers,
      participations,
      events,
      waitlist: waitlistAll,
    });

    const recentRegistrants = recentMembers.map((r) => {
      const completionPercent = computeProfileCompletionPercent(r);
      const missingFields = listMissingProfileFieldsFr(r);
      const engagement = engagementByMember.get(r.id) ?? {
        invitationsSent: 0,
        eventsConfirmed: 0,
        revenueMxn: 0,
        referralsMade: 0,
      };
      return {
        id: r.id,
        fullName: r.fullName ?? "",
        email: r.email ?? "",
        phone: r.phone ?? "",
        company: r.company ?? "",
        city: r.city ?? "",
        position: r.position ?? "",
        sector: r.sector ?? "",
        locale: r.locale ?? "",
        source: r.source ?? "",
        createdAt: r.createdAt ?? "",
        profileComplete: r.profileComplete ?? null,
        completionPercent,
        missingFields,
        referredByCode: r.referredByCode?.trim() || null,
        isExpress: isExpressSignup(r),
        invitationsSent: engagement.invitationsSent,
        eventsConfirmed: engagement.eventsConfirmed,
        revenueMxn: engagement.revenueMxn,
        referralsMade: engagement.referralsMade,
      };
    });

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

    const profilesNeedingAttention = waitlistActive.filter((r) => {
      const percent = computeProfileCompletionPercent(r);
      return isExpressSignup(r) || percent < 50;
    }).length;
    const distributions = {
      sectors: buildDistribution(waitlistActive, "sector"),
      positions: buildDistribution(waitlistActive, "position"),
      cities: buildDistribution(waitlistActive, "city"),
    };

    const recentTableDrafts = draftsSnap
      ? listRecentTableDraftSummaries(draftsSnap.docs, 3)
      : [];

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
        profilesNeedingAttention,
      },
      statusCounts,
      satisfaction: platformSatisfaction,
      events: byEvent,
      recentRegistrants,
      distributions,
      recentTableDrafts,
    });
  } catch (error) {
    console.error("[admin/dashboard]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}
