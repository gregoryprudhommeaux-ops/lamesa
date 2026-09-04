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
import { buildOpsQueues } from "@/lib/admin/ops-queues";
import {
  computeProfileCompletionPercent,
  isExpressSignup,
  listMissingProfileFieldsFr,
} from "@/lib/member/profile-completion";
import { listRecentTableDraftSummaries } from "@/lib/admin/table-drafts";
import { CITY_HUBS, resolveCityHub } from "@/lib/constants/city-hubs";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type {
  AdminEvent,
  AdminEventParticipation,
  WaitlistRegistration,
} from "@/lib/types/events";

const RECENT_REGISTRANTS_LIMIT = 25;

type DistributionMember = {
  id: string;
  fullName: string;
  email: string;
  company: string;
};

type DistributionBucket = {
  value: string;
  count: number;
  members: DistributionMember[];
};

function normalizeDistributionValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "__missing__";
}

function toDistributionMember(row: WaitlistRegistration): DistributionMember {
  return {
    id: row.id,
    fullName: row.fullName?.trim() || row.email || "Sans nom",
    email: row.email ?? "",
    company: row.company?.trim() ?? "",
  };
}

function sortDistributionMembers(members: DistributionMember[]): DistributionMember[] {
  return [...members].sort(
    (a, b) =>
      a.fullName.localeCompare(b.fullName, "fr", { sensitivity: "base" }) ||
      a.email.localeCompare(b.email, "fr"),
  );
}

function buildDistribution(
  rows: WaitlistRegistration[],
  field: "sector" | "position",
): DistributionBucket[] {
  const buckets = new Map<string, DistributionMember[]>();
  for (const row of rows) {
    let key = normalizeDistributionValue(row[field]);
    if (field === "sector" && key === "other") {
      const detail = row.sectorOther?.trim();
      key = detail ? `other:${detail}` : "other";
    }
    const list = buckets.get(key) ?? [];
    list.push(toDistributionMember(row));
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .map(([value, members]) => ({
      value,
      count: members.length,
      members: sortDistributionMembers(members),
    }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "fr"));
}

/** Always expose every hub (+ missing), so the dashboard reads as a hub table. */
function buildCityHubDistribution(rows: WaitlistRegistration[]): DistributionBucket[] {
  const buckets = new Map<string, DistributionMember[]>();
  for (const hub of CITY_HUBS) buckets.set(hub, []);

  const missing: DistributionMember[] = [];
  for (const row of rows) {
    const hub = resolveCityHub(row.city);
    const member = toDistributionMember(row);
    if (hub) {
      const list = buckets.get(hub) ?? [];
      list.push(member);
      buckets.set(hub, list);
    } else {
      missing.push(member);
    }
  }

  const hubs: DistributionBucket[] = CITY_HUBS.map((value) => {
    const members = sortDistributionMembers(buckets.get(value) ?? []);
    return { value, count: members.length, members };
  }).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "fr"));

  if (missing.length > 0) {
    hubs.push({
      value: "__missing__",
      count: missing.length,
      members: sortDistributionMembers(missing),
    });
  }
  return hubs;
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
        welcomeEmailStatus: r.welcomeEmailStatus ?? null,
        welcomeEmailSentAt: r.welcomeEmailSentAt ?? null,
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
      cities: buildCityHubDistribution(waitlistActive),
    };

    const recentTableDrafts = draftsSnap
      ? listRecentTableDraftSummaries(draftsSnap.docs, 3)
      : [];

    const opsQueues = buildOpsQueues({
      members: waitlistActive,
      participations,
    });

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
      opsQueues,
    });
  } catch (error) {
    console.error("[admin/dashboard]", error);
    const raw = error instanceof Error ? error.message : String(error);
    const detail = raw.slice(0, 400);
    const quota =
      /RESOURCE_EXHAUSTED|Quota exceeded/i.test(raw) ||
      (typeof (error as { code?: unknown })?.code === "number" &&
        (error as { code: number }).code === 8);
    return NextResponse.json(
      {
        ok: false,
        error: quota ? "firestore_quota_exceeded" : "fetch_failed",
        detail,
      },
      { status: 502 },
    );
  }
}
