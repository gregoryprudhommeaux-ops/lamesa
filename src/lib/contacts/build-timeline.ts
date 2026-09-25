import {
  countsAsConfirmed,
  countsAsInvitation,
} from "@/lib/admin/member-engagement";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { normalizeProspectEmail } from "@/lib/prospects/normalize";
import type { ContactActivity, ContactActivityType } from "@/lib/types/contact-activities";
import type { AdminEvent, AdminEventParticipation, WaitlistRegistration } from "@/lib/types/events";
import type { Prospect } from "@/lib/types/prospects";

export type TimelineEventLite = Pick<AdminEvent, "id" | "title" | "startsAt">;
export type TimelineParticipation = Pick<
  AdminEventParticipation,
  | "id"
  | "email"
  | "eventId"
  | "status"
  | "isOrganizer"
  | "createdAt"
  | "rsvpAt"
  | "confirmationEmailSentAt"
  | "calendarInviteSentAt"
  | "saveTheDateSentAt"
  | "satisfactionSurvey"
  | "satisfactionSurveySentAt"
>;

export type TimelineRespondent = {
  id: string;
  eventId: string;
  email: string;
  interestResponse?: string | null;
  attendance?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function dayKey(iso: string): string {
  return String(iso ?? "").slice(0, 10);
}

function dedupeKey(a: Pick<ContactActivity, "type" | "at" | "refs">): string {
  const ref =
    a.refs?.eventId ||
    a.refs?.participationId ||
    a.refs?.templateKey ||
    a.refs?.listName ||
    a.refs?.prospectId ||
    a.refs?.waitlistId ||
    "";
  return `${a.type}|${ref}|${dayKey(a.at)}`;
}

function derived(
  partial: Omit<ContactActivity, "id" | "createdAt" | "derived" | "email"> & {
    email: string;
    idSuffix: string;
  },
): ContactActivity {
  return {
    id: `derived:${partial.idSuffix}`,
    email: partial.email,
    type: partial.type,
    at: partial.at,
    source: partial.source,
    summary: partial.summary,
    refs: partial.refs,
    meta: partial.meta,
    createdAt: partial.at,
    derived: true,
  };
}

function eventTitle(events: TimelineEventLite[], eventId: string): string {
  return events.find((e) => e.id === eventId)?.title?.trim() || eventId;
}

/** Build derived activities from existing waitlist / prospect / participations. */
export function deriveContactActivities(input: {
  email: string;
  waitlist: WaitlistRegistration | null;
  prospect: Prospect | null;
  participations: TimelineParticipation[];
  events: TimelineEventLite[];
  respondents?: TimelineRespondent[];
}): ContactActivity[] {
  const email = normalizeProspectEmail(input.email);
  const out: ContactActivity[] = [];

  if (input.prospect?.createdAt) {
    out.push(
      derived({
        email,
        idSuffix: `prospect:${input.prospect.id}`,
        type: "added_prospect",
        at: input.prospect.createdAt,
        source: "system",
        summary: "Ajouté au CRM Prospects",
        refs: { prospectId: input.prospect.id },
      }),
    );
  }
  if (input.prospect?.lastContactedAt) {
    out.push(
      derived({
        email,
        idSuffix: `prospect-contacted:${input.prospect.id}:${dayKey(input.prospect.lastContactedAt)}`,
        type: "email_sent",
        at: input.prospect.lastContactedAt,
        source: "admin",
        summary: "Relance / cold email (historique)",
        refs: { prospectId: input.prospect.id, templateKey: "cold" },
      }),
    );
  }

  const w = input.waitlist;
  if (w?.createdAt) {
    out.push(
      derived({
        email,
        idSuffix: `waitlist:${w.id}`,
        type: "registered_platform",
        at: w.createdAt,
        source: "system",
        summary: "Inscription plateforme LA MESA",
        refs: { waitlistId: w.id },
      }),
    );
  }
  if (w?.welcomeEmailSentAt) {
    out.push(
      derived({
        email,
        idSuffix: `welcome:${w.id}`,
        type: "email_sent",
        at: w.welcomeEmailSentAt,
        source: "system",
        summary: "Email de bienvenue",
        refs: { waitlistId: w.id, templateKey: "welcome" },
      }),
    );
  }
  if (w?.fnAnnouncementEmailSentAt) {
    out.push(
      derived({
        email,
        idSuffix: `fn:${w.id}`,
        type: "email_sent",
        at: w.fnAnnouncementEmailSentAt,
        source: "admin",
        summary: "Annonce FrancoNetwork",
        refs: { waitlistId: w.id, templateKey: "fn_announcement" },
      }),
    );
  }
  if (w?.profileIncompleteEmailSentAt) {
    out.push(
      derived({
        email,
        idSuffix: `incomplete:${w.id}:${dayKey(w.profileIncompleteEmailSentAt)}`,
        type: "email_sent",
        at: w.profileIncompleteEmailSentAt,
        source: "admin",
        summary: "Rappel profil incomplet",
        refs: { waitlistId: w.id, templateKey: "profile_incomplete" },
      }),
    );
  }

  for (const p of input.participations) {
    if (isOrganizerParticipation(p)) continue;
    if (normalizeProspectEmail(p.email) !== email) continue;
    const status = normalizeParticipationStatus(p.status);
    const title = eventTitle(input.events, p.eventId);
    const invitedAt = p.calendarInviteSentAt || p.saveTheDateSentAt || p.createdAt;
    if (invitedAt && countsAsInvitation(status)) {
      out.push(
        derived({
          email,
          idSuffix: `invited:${p.id}`,
          type: "invited_event",
          at: invitedAt,
          source: "admin",
          summary: `Invité · ${title}`,
          refs: { eventId: p.eventId, participationId: p.id },
        }),
      );
    }
    if (status === "not_attending") {
      out.push(
        derived({
          email,
          idSuffix: `rsvp_no:${p.id}`,
          type: "rsvp_no",
          at: p.rsvpAt || p.createdAt || invitedAt || new Date(0).toISOString(),
          source: "guest",
          summary: `Refus · ${title}`,
          refs: { eventId: p.eventId, participationId: p.id },
        }),
      );
    }
    if (status === "attending") {
      out.push(
        derived({
          email,
          idSuffix: `rsvp_yes:${p.id}`,
          type: "rsvp_yes",
          at: p.rsvpAt || p.createdAt || invitedAt || new Date(0).toISOString(),
          source: "guest",
          summary: `RSVP oui · ${title}`,
          refs: { eventId: p.eventId, participationId: p.id },
        }),
      );
    }
    if (status === "confirmed") {
      out.push(
        derived({
          email,
          idSuffix: `confirmed:${p.id}`,
          type: "confirmed_seat",
          at: p.confirmationEmailSentAt || p.rsvpAt || p.createdAt || invitedAt || new Date(0).toISOString(),
          source: "admin",
          summary: `Place confirmée · ${title}`,
          refs: { eventId: p.eventId, participationId: p.id },
        }),
      );
    }
    const survey = p.satisfactionSurvey;
    if (survey?.submittedAt) {
      const reco =
        typeof survey.wouldRecommend === "number" ? survey.wouldRecommend : null;
      out.push(
        derived({
          email,
          idSuffix: `survey:${p.id}`,
          type: "survey_submitted",
          at: survey.submittedAt,
          source: "guest",
          summary:
            reco === null
              ? `Satisfaction · ${title}`
              : `Satisfaction · ${title} · reco ${reco}/5`,
          refs: { eventId: p.eventId, participationId: p.id },
          meta: {
            venueQuality: survey.venueQuality,
            menuQuality: survey.menuQuality,
            guestsQuality: survey.guestsQuality,
            wouldReturn: survey.wouldReturn,
            wouldRecommend: reco,
          },
        }),
      );
    } else if (p.satisfactionSurveySentAt) {
      out.push(
        derived({
          email,
          idSuffix: `survey-sent:${p.id}`,
          type: "email_sent",
          at: p.satisfactionSurveySentAt,
          source: "system",
          summary: `Questionnaire satisfaction envoyé · ${title}`,
          refs: {
            eventId: p.eventId,
            participationId: p.id,
            templateKey: "satisfaction_survey",
          },
        }),
      );
    }
  }

  for (const r of input.respondents ?? []) {
    if (normalizeProspectEmail(r.email) !== email) continue;
    const answer = String(r.interestResponse || "").trim().toLowerCase();
    if (answer !== "yes" && answer !== "no") continue;
    const title = eventTitle(input.events, r.eventId);
    const at = r.updatedAt || r.createdAt || new Date(0).toISOString();
    out.push(
      derived({
        email,
        idSuffix: `interest:${r.id}`,
        type: answer === "yes" ? "interest_yes" : "interest_no",
        at,
        source: "guest",
        summary: answer === "yes" ? `Intérêt OUI · ${title}` : `Intérêt NON · ${title}`,
        refs: { eventId: r.eventId },
      }),
    );
  }

  return out;
}

/**
 * Merge written + derived. Written wins on same type+primaryRef+day.
 * Sort by `at` descending.
 */
export function buildContactTimeline(input: {
  activities: ContactActivity[];
  derived: ContactActivity[];
}): ContactActivity[] {
  const map = new Map<string, ContactActivity>();
  for (const a of input.derived) {
    map.set(dedupeKey(a), a);
  }
  for (const a of input.activities) {
    map.set(dedupeKey(a), { ...a, derived: false });
  }
  return [...map.values()].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export function activityTypeLabel(type: ContactActivityType): string {
  const labels: Record<ContactActivityType, string> = {
    added_prospect: "CRM",
    registered_platform: "Inscription",
    email_sent: "Email",
    list_added: "Liste",
    status_changed: "Statut",
    invited_event: "Invitation",
    rsvp_yes: "RSVP oui",
    rsvp_no: "Refus",
    confirmed_seat: "Confirmé",
    seen_marked: "Vu",
    interest_yes: "Intérêt oui",
    interest_no: "Intérêt non",
    survey_submitted: "Satisfaction",
  };
  return labels[type] ?? type;
}
