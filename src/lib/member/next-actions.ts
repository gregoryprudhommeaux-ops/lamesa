import { computeProfileCompletionPercent } from "@/lib/member/profile-completion";
import { isPaidGuestStatus } from "@/lib/events/survey-eligibility";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { signSurveyToken } from "@/lib/email/rsvp-token";
import type { AdminEvent, AdminEventParticipation, WaitlistRegistration } from "@/lib/types/events";

export type MemberNextActionKind =
  | "fill_survey"
  | "pay_access"
  | "complete_profile"
  | "open_event";

export type MemberNextAction = {
  id: string;
  kind: MemberNextActionKind;
  href: string;
  event?: {
    id: string;
    slug: string;
    title: string;
    startsAt: string;
  };
  /** Profile completion % when kind = complete_profile. */
  completionPercent?: number;
  /** ACCESS price (before tax) when kind = pay_access. */
  priceMxn?: number | null;
};

type PartRow = AdminEventParticipation & { id: string };

/**
 * Resolve ordered “next steps” for the member dashboard.
 * Priority: survey → pay ACCESS → complete profile → next dinner.
 */
export function resolveMemberNextActions(input: {
  profile: WaitlistRegistration | null;
  participations: PartRow[];
  eventsById: Map<string, AdminEvent>;
  email: string;
  locale: "fr" | "en" | "es";
  siteBaseUrl: string;
  nowMs?: number;
  max?: number;
}): MemberNextAction[] {
  const now = input.nowMs ?? Date.now();
  const max = input.max ?? 3;
  const actions: MemberNextAction[] = [];
  const email = input.email.trim().toLowerCase();

  // 1) Pending satisfaction surveys (past dinners, paid, survey sent, not answered)
  const surveyCandidates = input.participations
    .filter((p) => {
      if (!isPaidGuestStatus(p.status)) return false;
      if (!p.satisfactionSurveySentAt) return false;
      if (p.satisfactionSurvey?.submittedAt) return false;
      const ev = input.eventsById.get(p.eventId);
      if (!ev) return false;
      return new Date(ev.startsAt).getTime() <= now;
    })
    .sort((a, b) => {
      const ea = input.eventsById.get(a.eventId)?.startsAt ?? "";
      const eb = input.eventsById.get(b.eventId)?.startsAt ?? "";
      return new Date(eb).getTime() - new Date(ea).getTime();
    });

  for (const p of surveyCandidates) {
    const ev = input.eventsById.get(p.eventId)!;
    let surveyUrl = `/${input.locale}/satisfaction`;
    try {
      const token = signSurveyToken({
        participationId: p.id,
        eventId: p.eventId,
        email: p.email || email,
      });
      surveyUrl = `${input.siteBaseUrl.replace(/\/$/, "")}/${input.locale}/satisfaction?token=${encodeURIComponent(token)}`;
    } catch {
      // Missing RSVP_TOKEN_SECRET in prod — still surface the action without link token.
      surveyUrl = `/${input.locale}/satisfaction`;
    }
    actions.push({
      id: `survey:${p.id}`,
      kind: "fill_survey",
      href: surveyUrl,
      event: {
        id: ev.id,
        slug: ev.slug,
        title: ev.title,
        startsAt: ev.startsAt,
      },
    });
  }

  // 2) Unpaid after formal invite (upcoming)
  const unpaid = input.participations
    .filter((p) => {
      const status = normalizeParticipationStatus(p.status);
      if (status === "confirmed" || status === "not_attending") return false;
      if (!p.calendarInviteSentAt) return false;
      const ev = input.eventsById.get(p.eventId);
      if (!ev) return false;
      return new Date(ev.startsAt).getTime() > now;
    })
    .sort((a, b) => {
      const ea = input.eventsById.get(a.eventId)?.startsAt ?? "";
      const eb = input.eventsById.get(b.eventId)?.startsAt ?? "";
      return new Date(ea).getTime() - new Date(eb).getTime();
    });

  for (const p of unpaid) {
    const ev = input.eventsById.get(p.eventId)!;
    actions.push({
      id: `pay:${p.id}`,
      kind: "pay_access",
      href: `/e/${encodeURIComponent(ev.slug)}`,
      event: {
        id: ev.id,
        slug: ev.slug,
        title: ev.title,
        startsAt: ev.startsAt,
      },
      priceMxn:
        typeof ev.priceMxn === "number" && Number.isFinite(ev.priceMxn) ? ev.priceMxn : null,
    });
  }

  // 3) Incomplete profile
  if (input.profile) {
    const percent = computeProfileCompletionPercent(input.profile);
    if (percent < 100) {
      actions.push({
        id: "profile",
        kind: "complete_profile",
        href: `/compte?tab=profil`,
        completionPercent: percent,
      });
    }
  }

  // 4) Soft: next confirmed upcoming dinner (if not already covered by pay)
  const payEventIds = new Set(unpaid.map((p) => p.eventId));
  const nextConfirmed = input.participations
    .filter((p) => {
      if (!isPaidGuestStatus(p.status)) return false;
      if (payEventIds.has(p.eventId)) return false;
      const ev = input.eventsById.get(p.eventId);
      if (!ev) return false;
      return new Date(ev.startsAt).getTime() > now;
    })
    .sort((a, b) => {
      const ea = input.eventsById.get(a.eventId)?.startsAt ?? "";
      const eb = input.eventsById.get(b.eventId)?.startsAt ?? "";
      return new Date(ea).getTime() - new Date(eb).getTime();
    })[0];

  if (nextConfirmed) {
    const ev = input.eventsById.get(nextConfirmed.eventId)!;
    actions.push({
      id: `event:${ev.id}`,
      kind: "open_event",
      href: `/e/${encodeURIComponent(ev.slug)}`,
      event: {
        id: ev.id,
        slug: ev.slug,
        title: ev.title,
        startsAt: ev.startsAt,
      },
    });
  }

  // Dedupe by id, cap
  const seen = new Set<string>();
  const out: MemberNextAction[] = [];
  for (const a of actions) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}
