/**
 * Lightweight audience fit signals for ContactPicker / Audience phase.
 * Epistemic: **observed** from waitlist + participations (not inferred AI scores).
 * Max a few chips — why invite this person to this dinner.
 */
import {
  countsAsConfirmed,
  countsAsInvitation,
} from "@/lib/admin/member-engagement";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { computeProfileCompletionPercent } from "@/lib/member/profile-completion";
import type { AdminEventParticipation, WaitlistRegistration } from "@/lib/types/events";

export type AudienceFitTone = "positive" | "neutral" | "caution";

export type AudienceFitSignal = {
  id: string;
  label: string;
  tone: AudienceFitTone;
};

export type AudienceFitSummary = {
  signals: AudienceFitSignal[];
  /** Compact secondary line (joined labels). */
  hint: string;
};

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

function normalizeCity(city: string | null | undefined): string {
  return String(city ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

type FitMember = Pick<
  WaitlistRegistration,
  "email" | "city" | "sector" | "position" | "company" | "fullName" | "phone" | "linkedinUrl" | "invitationMotivation" | "extraActivities" | "canBring" | "isSeeking" | "profileComplete" | "source"
>;

type FitPart = Pick<
  AdminEventParticipation,
  "email" | "status" | "isOrganizer" | "eventId" | "satisfactionSurvey" | "fullName"
>;

/**
 * Build observed invite-fit chips for one person.
 * @param excludeEventId — current dinner (don't count seats already on this event as “past”)
 */
export function resolveAudienceFitSignals(input: {
  member: FitMember | null;
  participations: FitPart[];
  eventCity?: string | null;
  excludeEventId?: string | null;
  maxSignals?: number;
}): AudienceFitSummary {
  const max = input.maxSignals ?? 3;
  const signals: AudienceFitSignal[] = [];
  const email = normalizeEmail(input.member?.email);
  const parts = input.participations.filter((p) => {
    if (isOrganizerParticipation(p)) return false;
    if (email && normalizeEmail(p.email) !== email) return false;
    if (input.excludeEventId && p.eventId === input.excludeEventId) return false;
    return true;
  });

  let invitations = 0;
  let confirmed = 0;
  let declined = 0;
  let satSum = 0;
  let satN = 0;

  for (const p of parts) {
    if (countsAsInvitation(p.status)) invitations += 1;
    if (countsAsConfirmed(p.status)) confirmed += 1;
    if (normalizeParticipationStatus(p.status) === "not_attending") declined += 1;
    const survey = p.satisfactionSurvey;
    if (survey?.submittedAt) {
      const scores = [
        survey.venueQuality,
        survey.menuQuality,
        survey.guestsQuality,
        survey.wouldReturn,
        typeof survey.wouldRecommend === "number" ? survey.wouldRecommend : null,
        typeof survey.valueForMoney === "number" ? survey.valueForMoney : null,
      ].filter((n): n is number => typeof n === "number" && Number.isFinite(n));
      if (scores.length > 0) {
        satSum += scores.reduce((a, b) => a + b, 0) / scores.length;
        satN += 1;
      }
    }
  }

  if (invitations === 0) {
    signals.push({ id: "never_invited", label: "Jamais invité", tone: "positive" });
  } else if (confirmed === 0 && declined === 0) {
    signals.push({
      id: "invited_never_paid",
      label: "Invité, jamais payé",
      tone: "caution",
    });
  }

  if (confirmed >= 2) {
    signals.push({
      id: "returning",
      label: `${confirmed} dîners payés`,
      tone: "positive",
    });
  } else if (confirmed === 1) {
    signals.push({ id: "past_guest", label: "Déjà venu", tone: "positive" });
  }

  if (declined > 0 && confirmed === 0) {
    signals.push({
      id: "declined_only",
      label: "A déjà décliné",
      tone: "caution",
    });
  }

  if (satN > 0) {
    const avg = Math.round((satSum / satN) * 10) / 10;
    if (avg >= 4.5) {
      signals.push({ id: "high_sat", label: `Sat ${avg}/5`, tone: "positive" });
    } else if (avg < 3.5) {
      signals.push({ id: "low_sat", label: `Sat ${avg}/5`, tone: "caution" });
    }
  }

  const eventCity = normalizeCity(input.eventCity);
  const memberCity = normalizeCity(input.member?.city);
  if (eventCity && memberCity && eventCity === memberCity) {
    signals.push({
      id: "same_city",
      label: input.member!.city!.trim(),
      tone: "neutral",
    });
  } else if (memberCity) {
    signals.push({
      id: "city",
      label: input.member!.city!.trim(),
      tone: "neutral",
    });
  }

  if (input.member) {
    const pct = computeProfileCompletionPercent(input.member);
    if (pct < 70) {
      signals.push({
        id: "incomplete",
        label: `Profil ${pct}%`,
        tone: "caution",
      });
    }
  }

  // Deduplicate by id, keep order, cap
  const seen = new Set<string>();
  const capped: AudienceFitSignal[] = [];
  for (const s of signals) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    capped.push(s);
    if (capped.length >= max) break;
  }

  return {
    signals: capped,
    hint: capped.map((s) => s.label).join(" · "),
  };
}

/** Index waitlist + participations for O(1) lookup in the picker. */
export function buildAudienceFitIndex(input: {
  waitlist: FitMember[];
  participations: FitPart[];
  eventCity?: string | null;
  excludeEventId?: string | null;
}): Map<string, AudienceFitSummary> {
  const partsByEmail = new Map<string, FitPart[]>();
  for (const p of input.participations) {
    if (isOrganizerParticipation(p)) continue;
    const email = normalizeEmail(p.email);
    if (!email) continue;
    const list = partsByEmail.get(email) ?? [];
    list.push(p);
    partsByEmail.set(email, list);
  }

  const out = new Map<string, AudienceFitSummary>();
  for (const member of input.waitlist) {
    const email = normalizeEmail(member.email);
    if (!email) continue;
    out.set(
      email,
      resolveAudienceFitSignals({
        member,
        participations: partsByEmail.get(email) ?? [],
        eventCity: input.eventCity,
        excludeEventId: input.excludeEventId,
      }),
    );
  }
  return out;
}
