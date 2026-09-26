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
import {
  DEFAULT_GUEST_CAPACITY,
  isOrganizerParticipation,
} from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { computeEventIva } from "@/lib/events/pricing";
import {
  ADMIN_SCAN,
  loadAdminCoreCollections,
} from "@/lib/admin/load-core-collections";
import {
  pickLastPastEvent,
  resolveDashboardMoment,
} from "@/lib/admin/dashboard-moment";
import { buildMemberEngagementIndex } from "@/lib/admin/member-engagement";
import { buildLastEventRecap } from "@/lib/admin/last-event-recap";
import { buildOpsQueues } from "@/lib/admin/ops-queues";
import {
  buildNextEventRsvpSummary,
  isStdListForEvent,
  pickNextUpcomingEvent,
} from "@/lib/admin/next-event-rsvp";
import {
  buildLastEmailResultsSummary,
  inferLastEmailCampaignFromEvents,
  inferLastEmailCampaignFromProspects,
  inferLastPlacesAvailableCampaign,
  inferLatestOutboundEmail,
  loadLastEmailCampaign,
  loadRecentEmailCampaigns,
  mergeCampaignHistory,
  pickLatestCampaign,
  toEmailCampaignHistoryRow,
  type EmailCampaignHistoryRow,
  type LastEmailCampaignRecord,
} from "@/lib/admin/last-email-campaign";
import { listRecentTableDraftSummaries } from "@/lib/admin/table-drafts";
import { CITY_HUBS, resolveCityHub } from "@/lib/constants/city-hubs";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  computeProfileCompletionPercent,
  isExpressSignup,
  listMissingProfileFieldsFr,
} from "@/lib/member/profile-completion";
import { isLegitimateWaitlistMember } from "@/lib/member/waitlist-legitimacy";
import {
  PLACES_AVAILABLE_AUTO_INSCRIT_KEEP_NAMES,
  softDeleteAdminProvisionedWaitlistStubs,
} from "@/lib/member/revoke-admin-waitlist-stubs";
import type { EventRespondent, WaitlistRegistration } from "@/lib/types/events";
import type { Prospect } from "@/lib/types/prospects";
import { normalizeProspectStatus } from "@/lib/prospects/normalize";
import { eventSlugFromOutreachTemplateKey } from "@/lib/events/std-outreach-templates";

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

type RsvpProspectRow = Pick<
  Prospect,
  | "id"
  | "email"
  | "fullName"
  | "company"
  | "status"
  | "lists"
  | "deletedAt"
  | "sentTemplateKeys"
  | "lastContactedAt"
>;

function prospectFromDoc(
  id: string,
  data: Record<string, unknown>,
): RsvpProspectRow {
  return {
    id,
    email: String(data.email ?? ""),
    fullName: String(data.fullName ?? ""),
    company: String(data.company ?? ""),
    status: normalizeProspectStatus(data.status),
    lists: Array.isArray(data.lists) ? data.lists.map(String) : [],
    deletedAt: typeof data.deletedAt === "string" ? data.deletedAt : null,
    sentTemplateKeys: Array.isArray(data.sentTemplateKeys)
      ? data.sentTemplateKeys.map(String)
      : [],
    lastContactedAt:
      typeof data.lastContactedAt === "string" ? data.lastContactedAt : null,
  };
}

async function loadProspectsForEventSlug(
  db: FirebaseFirestore,
  eventSlug: string,
): Promise<RsvpProspectRow[]> {
  const listsSnap = await db.collection(COLLECTIONS.prospectLists).limit(200).get();
  const eventListNames = listsSnap.docs
    .map((d) => String((d.data() as { name?: string }).name ?? "").trim())
    .filter((name) => isStdListForEvent(name, eventSlug));

  const byId = new Map<string, RsvpProspectRow>();
  await Promise.all(
    eventListNames.map(async (listName) => {
      const snap = await db
        .collection(COLLECTIONS.prospects)
        .where("lists", "array-contains", listName)
        .limit(400)
        .get();
      for (const doc of snap.docs) {
        if (byId.has(doc.id)) continue;
        byId.set(doc.id, prospectFromDoc(doc.id, doc.data() as Record<string, unknown>));
      }
    }),
  );
  return [...byId.values()];
}

async function loadRespondentsForEvent(
  db: FirebaseFirestore,
  eventId: string,
): Promise<EventRespondent[]> {
  const respondentsSnap = await db
    .collection(COLLECTIONS.respondents)
    .where("eventId", "==", eventId)
    .limit(500)
    .get();
  return respondentsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<EventRespondent, "id">),
  }));
}

// Avoid importing Firestore type from firebase-admin in every call site.
type FirebaseFirestore = ReturnType<typeof getAdminFirestore>;

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
    // Shared + TTL-cached with other admin routes to avoid triple-scans per navigation.
    const draftsPromise = db
      .collection(COLLECTIONS.tableDrafts)
      .limit(ADMIN_SCAN.drafts)
      .get()
      .catch((error) => {
        console.error("[admin/dashboard drafts]", error);
        return null;
      });
    const [core, draftsSnap] = await Promise.all([
      loadAdminCoreCollections(),
      draftsPromise,
    ]);

    const { events, participations } = core;
    const waitlistAll = core.waitlist;

    // One-shot cleanup: soft-delete waitlist stubs invented by places_available blast.
    // Keeps Julian TORRES + Alice MUZELLEC (NON). Idempotent.
    void softDeleteAdminProvisionedWaitlistStubs(waitlistAll, {
      sources: ["la-mesa-places-available"],
      keepNameTokenGroups: PLACES_AVAILABLE_AUTO_INSCRIT_KEEP_NAMES,
      deletedReason: "places-available-auto-inscrit-revoked",
    })
      .then((result) => {
        if (result.revoked > 0) {
          console.info("[admin/dashboard] revoked auto-inscrit stubs", result);
        }
      })
      .catch((err) => console.warn("[admin/dashboard] revoke auto-inscrit failed", err));

    const waitlistActive = waitlistAll.filter((r) => isLegitimateWaitlistMember(r));

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
      comped: 0,
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

    const nextEvent = pickNextUpcomingEvent(events);
    let nextEventRespondents: EventRespondent[] = [];
    let nextEventProspects: RsvpProspectRow[] = [];
    if (nextEvent) {
      try {
        nextEventRespondents = await loadRespondentsForEvent(db, nextEvent.id);
      } catch (error) {
        console.error("[admin/dashboard] next-event respondents", error);
      }

      try {
        nextEventProspects = await loadProspectsForEventSlug(db, nextEvent.slug);
      } catch (error) {
        console.error("[admin/dashboard] next-event prospects", error);
      }
    }

    const nextEventRsvp = buildNextEventRsvpSummary({
      events,
      participations,
      respondents: nextEventRespondents,
      prospects: nextEventProspects,
    });

    let lastEmailResults = null as ReturnType<typeof buildLastEmailResultsSummary> | null;
    let emailCampaignHistory: EmailCampaignHistoryRow[] = [];
    try {
      const waitlistByEmail = new Map(
        waitlistActive
          .filter((r) => String(r.email ?? "").includes("@"))
          .map((r) => {
            const email = String(r.email ?? "").trim().toLowerCase();
            return [
              email,
              {
                id: r.id,
                email,
                fullName: r.fullName ?? "",
                company: r.company ?? "",
                source: r.source ?? "",
                profileComplete: r.profileComplete ?? null,
                createdAt: r.createdAt ?? "",
              },
            ] as const;
          }),
      );
      const storedCampaign = await loadLastEmailCampaign();
      const recentCampaigns = await loadRecentEmailCampaigns(8);
      const inferredFromEvents = inferLastEmailCampaignFromEvents(events, participations);
      const inferredFromProspects = inferLastEmailCampaignFromProspects(
        nextEventProspects,
        events,
      );
      const inferredPlaces = inferLastPlacesAvailableCampaign(events, participations);
      const inferredOutbound = inferLatestOutboundEmail(events, participations);
      const campaign = pickLatestCampaign(
        storedCampaign,
        recentCampaigns[0] ?? null,
        inferredFromEvents,
        inferredFromProspects,
        inferredPlaces,
        inferredOutbound,
      );

      const prospectsCache = new Map<string, RsvpProspectRow[]>();
      const respondentsCache = new Map<string, EventRespondent[]>();
      if (nextEvent) {
        prospectsCache.set(nextEvent.slug.toLowerCase(), nextEventProspects);
        respondentsCache.set(nextEvent.id, nextEventRespondents);
      }

      async function loadProspectsCached(slug: string): Promise<RsvpProspectRow[]> {
        const key = slug.trim().toLowerCase();
        if (!key) return [];
        if (prospectsCache.has(key)) return prospectsCache.get(key)!;
        try {
          const rows = await loadProspectsForEventSlug(db, slug);
          prospectsCache.set(key, rows);
          return rows;
        } catch (error) {
          console.error("[admin/dashboard] prospects cache", slug, error);
          prospectsCache.set(key, []);
          return [];
        }
      }

      async function loadRespondentsCached(eventId: string): Promise<EventRespondent[]> {
        if (!eventId) return [];
        if (respondentsCache.has(eventId)) return respondentsCache.get(eventId)!;
        try {
          const rows = await loadRespondentsForEvent(db, eventId);
          respondentsCache.set(eventId, rows);
          return rows;
        } catch (error) {
          console.error("[admin/dashboard] respondents cache", eventId, error);
          respondentsCache.set(eventId, []);
          return [];
        }
      }

      async function summarizeCampaign(c: LastEmailCampaignRecord) {
        const campaignEventId =
          c.eventId ||
          events.find(
            (e) =>
              c.eventSlug &&
              e.slug.trim().toLowerCase() === c.eventSlug.trim().toLowerCase(),
          )?.id ||
          null;
        const campaignSlug =
          c.eventSlug ||
          (c.templateKey ? eventSlugFromOutreachTemplateKey(c.templateKey) : null);
        const [lastRespondents, lastProspects] = await Promise.all([
          campaignEventId ? loadRespondentsCached(campaignEventId) : Promise.resolve([]),
          campaignSlug ? loadProspectsCached(campaignSlug) : Promise.resolve([]),
        ]);
        return buildLastEmailResultsSummary({
          campaign: {
            ...c,
            eventId: c.eventId || campaignEventId,
            eventSlug: c.eventSlug || campaignSlug,
          },
          events,
          participations,
          respondents: lastRespondents,
          prospects: lastProspects,
          waitlistByEmail,
        });
      }

      if (campaign) {
        lastEmailResults = await summarizeCampaign(campaign);
      }

      const historySource = mergeCampaignHistory(recentCampaigns, [
        campaign,
        inferredOutbound,
        inferredFromEvents,
        inferredFromProspects,
        inferredPlaces,
        storedCampaign,
      ]);
      const historyRows: EmailCampaignHistoryRow[] = [];
      for (const c of historySource.slice(0, 6)) {
        // Skip duplicate of the live last-email row when ids match.
        if (
          lastEmailResults &&
          c.id &&
          lastEmailResults.id &&
          c.id === lastEmailResults.id
        ) {
          historyRows.push(toEmailCampaignHistoryRow(lastEmailResults, c.id));
          continue;
        }
        if (
          lastEmailResults &&
          !c.id &&
          c.templateKey === lastEmailResults.templateKey &&
          c.sentAt === lastEmailResults.sentAt
        ) {
          historyRows.push(
            toEmailCampaignHistoryRow(lastEmailResults, lastEmailResults.id),
          );
          continue;
        }
        const summary = await summarizeCampaign(c);
        historyRows.push(toEmailCampaignHistoryRow(summary, c.id ?? summary.templateKey));
      }
      emailCampaignHistory = historyRows;
    } catch (error) {
      console.error("[admin/dashboard] last-email results", error);
    }

    const pastEvent = pickLastPastEvent(events);
    let pastEventFocus = null as {
      eventId: string;
      eventSlug: string;
      title: string;
      startsAt: string;
      confirmedCount: number;
      revenueMxn: number;
      priceMxn: number | null;
      surveySentCount: number;
      surveyResponseCount: number;
      satisfaction: ReturnType<typeof computeEventSatisfaction>;
    } | null;

    if (pastEvent) {
      const pastParts = participations.filter((p) => p.eventId === pastEvent.id);
      const guests = pastParts.filter((p) => !isOrganizerParticipation(p));
      const confirmedGuests = guests.filter(
        (p) => normalizeParticipationStatus(p.status) === "confirmed",
      );
      const priceRaw =
        typeof pastEvent.priceMxn === "number" && Number.isFinite(pastEvent.priceMxn)
          ? pastEvent.priceMxn
          : 0;
      const unitTtc = computeEventIva(priceRaw, {
        includeIva: pastEvent.priceIncludesIva !== false,
        includeService: pastEvent.priceIncludesService !== false,
      }).totalWithIva;
      const revenueMxn =
        Math.round(unitTtc * confirmedGuests.length * 100) / 100;
      const sat = computeEventSatisfaction(pastParts);
      pastEventFocus = {
        eventId: pastEvent.id,
        eventSlug: pastEvent.slug,
        title: pastEvent.title,
        startsAt: pastEvent.startsAt,
        confirmedCount: confirmedGuests.length,
        revenueMxn,
        priceMxn: priceRaw > 0 ? priceRaw : null,
        surveySentCount: sat.sentCount,
        surveyResponseCount: sat.responseCount,
        satisfaction: sat,
      };
    }

    const dashboardMoment = resolveDashboardMoment({
      lastEmail: lastEmailResults
        ? {
            templateKey: lastEmailResults.templateKey,
            sentAt: lastEmailResults.sentAt,
            eventId: lastEmailResults.eventId,
          }
        : null,
      nextEvent: nextEventRsvp
        ? { eventId: nextEventRsvp.eventId, startsAt: nextEventRsvp.startsAt }
        : null,
      pastEvent: pastEventFocus
        ? {
            eventId: pastEventFocus.eventId,
            startsAt: pastEventFocus.startsAt,
            surveySentCount: pastEventFocus.surveySentCount,
            surveyResponseCount: pastEventFocus.surveyResponseCount,
          }
        : null,
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
      nextEventRsvp,
      lastEventRecap: buildLastEventRecap(events, participations),
      lastEmailResults,
      emailCampaignHistory,
      pastEventFocus,
      dashboardMoment,
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
