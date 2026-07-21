import { countsAsInvitation } from "@/lib/admin/member-engagement";
import { citiesInSameHub, resolveCityHub } from "@/lib/constants/city-hubs";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { computeProfileCompletionPercent } from "@/lib/member/profile-completion";
import type {
  AdminEvent,
  AdminEventParticipation,
  WaitlistRegistration,
} from "@/lib/types/events";
import type { AiCandidateCard, CompletionBand, TableCandidate } from "./types";

const AI_TEXT_MAX_LENGTH = 500;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const LINKEDIN_RE =
  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/gi;
/** International-ish phone patterns: +52 55..., (415) 555-0199, 415.555.0199, etc. */
const PHONE_RE =
  /(?:\+|00)?\d{1,3}[\s./-]?(?:\(?\d{2,4}\)?[\s./-]?){2,4}\d{2,4}/g;

const normalizeText = (value?: string | null) =>
  (value ?? "").trim().toLocaleLowerCase("es-MX");

function completionBand(percent: number): CompletionBand {
  if (percent >= 80) return "high";
  if (percent < 50) return "low";
  return "mid";
}

/** Scrub obvious contact PII from free text while keeping surrounding useful content. */
export function scrubContactText(value: string): string {
  return value
    .replace(EMAIL_RE, " ")
    .replace(LINKEDIN_RE, " ")
    .replace(PHONE_RE, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function prepareAiText(value: string): string {
  return scrubContactText(value).slice(0, AI_TEXT_MAX_LENGTH);
}

function latestEvent(events: AdminEvent[]): AdminEvent | undefined {
  return events.reduce<AdminEvent | undefined>((latest, current) => {
    if (!latest) return current;
    return new Date(current.startsAt).getTime() > new Date(latest.startsAt).getTime()
      ? current
      : latest;
  }, undefined);
}

export function buildEligiblePool(input: {
  members: WaitlistRegistration[];
  participations: AdminEventParticipation[];
  events: AdminEvent[];
  city: string;
  excludeMemberIds?: string[];
}): {
  candidates: TableCandidate[];
  aiCards: AiCandidateCard[];
  previousEventId: string | null;
} {
  const cityHub = resolveCityHub(input.city);
  if (!cityHub && !(input.city ?? "").trim()) {
    return { candidates: [], aiCards: [], previousEventId: null };
  }

  const excludedIds = new Set(input.excludeMemberIds ?? []);
  const eligibleMembers = input.members.filter(
    (member) =>
      !member.deletedAt &&
      !excludedIds.has(member.id) &&
      citiesInSameHub(member.city, input.city),
  );

  const now = Date.now();
  const pastEvents = input.events.filter((event) => {
    const startsAt = new Date(event.startsAt).getTime();
    return Number.isFinite(startsAt) && startsAt < now;
  });
  const matchingCityEvents = pastEvents.filter(
    (event) => Boolean(event.city?.trim()) && citiesInSameHub(event.city, input.city),
  );
  const previousEvent = latestEvent(
    matchingCityEvents.length > 0 ? matchingCityEvents : pastEvents,
  );
  const previousEventId = previousEvent?.id ?? null;
  const pastEventIds = new Set(pastEvents.map(({ id }) => id));

  const eligibleById = new Map(eligibleMembers.map((member) => [member.id, member]));
  const emailOwnerByNormalized = new Map<string, string | null>();
  for (const member of eligibleMembers) {
    const email = normalizeText(member.email);
    if (!email) continue;
    if (!emailOwnerByNormalized.has(email)) {
      emailOwnerByNormalized.set(email, member.id);
      continue;
    }
    // Ambiguous duplicate among eligible candidates: refuse silent ownership.
    emailOwnerByNormalized.set(email, null);
  }

  const resolveMemberId = (row: AdminEventParticipation): string | undefined => {
    const contactId = row.contactId?.trim();
    if (contactId && eligibleById.has(contactId)) return contactId;
    return emailOwnerByNormalized.get(normalizeText(row.email)) ?? undefined;
  };

  const historicalParticipations = input.participations
    .filter((row) => pastEventIds.has(row.eventId))
    .map((row) => ({ row, memberId: resolveMemberId(row) }));

  const invitationCountByMember = new Map<string, number>();
  const previousInviteeIds = new Set<string>();
  const attendingMemberIdsByEvent = new Map<string, Set<string>>();

  for (const { row, memberId } of historicalParticipations) {
    if (!memberId) continue;

    if (!row.isOrganizer && countsAsInvitation(row.status)) {
      invitationCountByMember.set(
        memberId,
        (invitationCountByMember.get(memberId) ?? 0) + 1,
      );
      if (row.eventId === previousEventId) previousInviteeIds.add(memberId);
    }

    const status = normalizeParticipationStatus(row.status);
    if (row.isOrganizer || (status !== "confirmed" && status !== "attending")) continue;
    const attendees = attendingMemberIdsByEvent.get(row.eventId) ?? new Set<string>();
    attendees.add(memberId);
    attendingMemberIdsByEvent.set(row.eventId, attendees);
  }

  const coPresentIdsByMember = new Map<string, Set<string>>();
  for (const attendees of attendingMemberIdsByEvent.values()) {
    for (const memberId of attendees) {
      const coPresentIds = coPresentIdsByMember.get(memberId) ?? new Set<string>();
      for (const otherMemberId of attendees) {
        if (otherMemberId !== memberId) coPresentIds.add(otherMemberId);
      }
      coPresentIdsByMember.set(memberId, coPresentIds);
    }
  }

  const candidates = eligibleMembers.map<TableCandidate>((member) => {
    const completionPercent = computeProfileCompletionPercent(member);
    return {
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      company: member.company,
      sector: member.sector,
      position: member.position,
      city: member.city,
      invitationMotivation: member.invitationMotivation,
      extraActivities: member.extraActivities,
      canBring: member.canBring ?? "",
      isSeeking: member.isSeeking ?? "",
      completionPercent,
      completionBand: completionBand(completionPercent),
      invitationCount: invitationCountByMember.get(member.id) ?? 0,
      invitedToPreviousEvent: previousInviteeIds.has(member.id),
      coPresentMemberIds: [...(coPresentIdsByMember.get(member.id) ?? [])],
      referredById: member.referredById,
    };
  });

  const aiCards = candidates.map<AiCandidateCard>((candidate) => ({
    id: candidate.id,
    company: prepareAiText(candidate.company),
    sector: prepareAiText(candidate.sector),
    position: prepareAiText(candidate.position),
    city: prepareAiText(candidate.city),
    invitationMotivation: prepareAiText(candidate.invitationMotivation),
    extraActivities: candidate.extraActivities.map(prepareAiText),
    canBring: prepareAiText(candidate.canBring),
    isSeeking: prepareAiText(candidate.isSeeking),
    completionPercent: candidate.completionPercent,
    completionBand: candidate.completionBand,
    invitationCount: candidate.invitationCount,
    invitedToPreviousEvent: candidate.invitedToPreviousEvent,
  }));

  return { candidates, aiCards, previousEventId };
}
