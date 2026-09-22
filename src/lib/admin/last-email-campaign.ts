/**
 * Track the most recent outreach email blast and compute OUI/NON/pending
 * for its recipient cohort (dashboard cockpit).
 */
import {
  computeInterestRsvpEmailSets,
  type NextEventRsvpYesGuest,
  type RsvpProspectSlice,
} from "@/lib/admin/next-event-rsvp";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { interestSansReponseListName } from "@/lib/events/interest-prospect-lists";
import { eventSlugFromOutreachTemplateKey } from "@/lib/events/std-outreach-templates";
import { templateLabel } from "@/lib/email/template-defaults";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type {
  AdminEvent,
  AdminEventParticipation,
  EmailTemplateKey,
  EventRespondent,
} from "@/lib/types/events";

export const LAST_EMAIL_CAMPAIGN_DOC_ID = "last_email_campaign";

/** Keep Firestore docs small; counts still use recipientCount. */
const MAX_STORED_RECIPIENT_EMAILS = 400;

/** Prospects contacted within this window of the latest lastContactedAt count as one wave. */
const INFER_WAVE_MS = 12 * 60 * 60 * 1000;

export type LastEmailCampaignSource =
  | "cold_outreach"
  | "save_the_date"
  | "inferred";

export type LastEmailCampaignRecord = {
  templateKey: string;
  templateLabel: string;
  sentAt: string;
  recipientCount: number;
  recipientEmails: string[];
  eventSlug: string | null;
  eventId: string | null;
  eventTitle: string | null;
  source: LastEmailCampaignSource;
  updatedAt: string;
};

export type LastEmailResultsSummary = {
  templateKey: string;
  templateLabel: string;
  sentAt: string;
  recipientCount: number;
  eventId: string | null;
  eventSlug: string | null;
  eventTitle: string | null;
  responseMode: "interest" | "rsvp" | "none";
  yes: number;
  no: number;
  other: number;
  pending: number;
  sansReponseListName?: string;
  yesGuests: NextEventRsvpYesGuest[];
  source: LastEmailCampaignSource;
};

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

function uniqEmails(emails: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of emails) {
    const email = normalizeEmail(raw);
    if (!email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function normalizeLastEmailCampaignRecord(
  data: Record<string, unknown> | null | undefined,
): LastEmailCampaignRecord | null {
  if (!data) return null;
  const templateKey = String(data.templateKey ?? "").trim();
  const sentAt = String(data.sentAt ?? "").trim();
  if (!templateKey || !sentAt) return null;
  const recipientEmails = uniqEmails(
    Array.isArray(data.recipientEmails) ? data.recipientEmails.map(String) : [],
  );
  const recipientCountRaw = Number(data.recipientCount);
  const recipientCount =
    Number.isFinite(recipientCountRaw) && recipientCountRaw >= 0
      ? Math.max(recipientCountRaw, recipientEmails.length)
      : recipientEmails.length;
  const sourceRaw = String(data.source ?? "inferred");
  const source: LastEmailCampaignSource =
    sourceRaw === "cold_outreach" ||
    sourceRaw === "save_the_date" ||
    sourceRaw === "inferred"
      ? sourceRaw
      : "inferred";

  return {
    templateKey,
    templateLabel:
      String(data.templateLabel ?? "").trim() ||
      templateLabel(templateKey as EmailTemplateKey),
    sentAt,
    recipientCount,
    recipientEmails,
    eventSlug: String(data.eventSlug ?? "").trim() || null,
    eventId: String(data.eventId ?? "").trim() || null,
    eventTitle: String(data.eventTitle ?? "").trim() || null,
    source,
    updatedAt: String(data.updatedAt ?? sentAt),
  };
}

/** Persist the latest blast pointer (Admin SDK only). Soft-fails. */
export async function recordLastEmailCampaign(input: {
  templateKey: string;
  templateLabel?: string | null;
  sentAt?: string;
  recipientEmails: string[];
  eventSlug?: string | null;
  eventId?: string | null;
  eventTitle?: string | null;
  source: Exclude<LastEmailCampaignSource, "inferred">;
}): Promise<boolean> {
  try {
    if (!isFirebaseAdminConfigured()) return false;
    const emails = uniqEmails(input.recipientEmails);
    if (emails.length === 0) return false;
    const now = new Date().toISOString();
    const templateKey = input.templateKey.trim();
    if (!templateKey) return false;
    const eventSlug =
      input.eventSlug?.trim() ||
      eventSlugFromOutreachTemplateKey(templateKey) ||
      null;
    const record: LastEmailCampaignRecord = {
      templateKey,
      templateLabel:
        input.templateLabel?.trim() ||
        templateLabel(templateKey as EmailTemplateKey),
      sentAt: input.sentAt?.trim() || now,
      recipientCount: emails.length,
      recipientEmails: emails.slice(0, MAX_STORED_RECIPIENT_EMAILS),
      eventSlug,
      eventId: input.eventId?.trim() || null,
      eventTitle: input.eventTitle?.trim() || null,
      source: input.source,
      updatedAt: now,
    };
    await getAdminFirestore()
      .collection(COLLECTIONS.ops)
      .doc(LAST_EMAIL_CAMPAIGN_DOC_ID)
      .set(record, { merge: true });
    return true;
  } catch (error) {
    console.error("[last-email-campaign] record failed", error);
    return false;
  }
}

export async function loadLastEmailCampaign(): Promise<LastEmailCampaignRecord | null> {
  try {
    if (!isFirebaseAdminConfigured()) return null;
    const snap = await getAdminFirestore()
      .collection(COLLECTIONS.ops)
      .doc(LAST_EMAIL_CAMPAIGN_DOC_ID)
      .get();
    if (!snap.exists) return null;
    return normalizeLastEmailCampaignRecord(snap.data() as Record<string, unknown>);
  } catch (error) {
    console.error("[last-email-campaign] load failed", error);
    return null;
  }
}

function lastTemplateKey(keys: string[] | undefined): string | null {
  const list = (keys ?? []).map((k) => k.trim()).filter(Boolean);
  return list.length ? list[list.length - 1]! : null;
}

/**
 * Infer the latest outreach wave from prospect lastContactedAt stamps
 * when no ops pointer has been written yet.
 */
export function inferLastEmailCampaignFromProspects(
  prospects: RsvpProspectSlice[],
  events: AdminEvent[] = [],
): LastEmailCampaignRecord | null {
  const active = prospects.filter((p) => !isSoftDeleted(p) && p.lastContactedAt);
  if (active.length === 0) return null;

  let maxMs = 0;
  for (const p of active) {
    const ms = new Date(p.lastContactedAt ?? 0).getTime();
    if (Number.isFinite(ms) && ms > maxMs) maxMs = ms;
  }
  if (maxMs <= 0) return null;

  const wave = active.filter((p) => {
    const ms = new Date(p.lastContactedAt ?? 0).getTime();
    return Number.isFinite(ms) && maxMs - ms <= INFER_WAVE_MS;
  });
  if (wave.length === 0) return null;

  // Prefer the last template on the most recently contacted prospect(s).
  const newest = wave.filter(
    (p) => new Date(p.lastContactedAt ?? 0).getTime() === maxMs,
  );
  const keyCounts = new Map<string, number>();
  for (const p of newest.length ? newest : wave) {
    const key = lastTemplateKey(p.sentTemplateKeys);
    if (!key) continue;
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }
  let templateKey = "";
  let best = 0;
  for (const [key, count] of keyCounts) {
    if (count > best || (count === best && key.localeCompare(templateKey) < 0)) {
      templateKey = key;
      best = count;
    }
  }
  if (!templateKey) return null;

  const recipients = uniqEmails(
    wave
      .filter((p) => (p.sentTemplateKeys ?? []).includes(templateKey))
      .map((p) => p.email),
  );
  if (recipients.length === 0) return null;

  const eventSlug = eventSlugFromOutreachTemplateKey(templateKey);
  const event = eventSlug
    ? events.find((e) => e.slug.trim().toLowerCase() === eventSlug.toLowerCase())
    : undefined;

  return {
    templateKey,
    templateLabel: templateLabel(templateKey as EmailTemplateKey),
    sentAt: new Date(maxMs).toISOString(),
    recipientCount: recipients.length,
    recipientEmails: recipients.slice(0, MAX_STORED_RECIPIENT_EMAILS),
    eventSlug: eventSlug ?? event?.slug ?? null,
    eventId: event?.id ?? null,
    eventTitle: event?.title ?? null,
    source: "inferred",
    updatedAt: new Date(maxMs).toISOString(),
  };
}

/**
 * Prefer an event-level Save the Date stamp when it is newer than prospect inference.
 */
export function inferLastEmailCampaignFromEvents(
  events: AdminEvent[],
  participations: AdminEventParticipation[],
): LastEmailCampaignRecord | null {
  let best: { event: AdminEvent; sentAtMs: number } | null = null;
  for (const event of events) {
    const stamp = event.saveTheDateSentAt;
    const ms = stamp ? new Date(stamp).getTime() : NaN;
    if (!Number.isFinite(ms)) continue;
    if (!best || ms > best.sentAtMs) best = { event, sentAtMs: ms };
  }
  if (!best) return null;

  const emails = uniqEmails(
    participations
      .filter((p) => p.eventId === best!.event.id && !isOrganizerParticipation(p))
      .filter((p) => Boolean(p.saveTheDateSentAt))
      .map((p) => p.email ?? ""),
  );

  return {
    templateKey: "save_the_date",
    templateLabel: templateLabel("save_the_date"),
    sentAt: new Date(best.sentAtMs).toISOString(),
    recipientCount: emails.length || 0,
    recipientEmails: emails.slice(0, MAX_STORED_RECIPIENT_EMAILS),
    eventSlug: best.event.slug,
    eventId: best.event.id,
    eventTitle: best.event.title,
    source: "inferred",
    updatedAt: new Date(best.sentAtMs).toISOString(),
  };
}

export function pickLatestCampaign(
  ...candidates: Array<LastEmailCampaignRecord | null | undefined>
): LastEmailCampaignRecord | null {
  let best: LastEmailCampaignRecord | null = null;
  for (const c of candidates) {
    if (!c) continue;
    const ms = new Date(c.sentAt).getTime();
    if (!Number.isFinite(ms)) continue;
    if (!best || ms > new Date(best.sentAt).getTime()) best = c;
  }
  return best;
}

function resolveEventForCampaign(
  campaign: LastEmailCampaignRecord,
  events: AdminEvent[],
): AdminEvent | null {
  if (campaign.eventId) {
    const byId = events.find((e) => e.id === campaign.eventId);
    if (byId) return byId;
  }
  if (campaign.eventSlug) {
    const slug = campaign.eventSlug.trim().toLowerCase();
    return events.find((e) => e.slug.trim().toLowerCase() === slug) ?? null;
  }
  return null;
}

/**
 * Build OUI/NON/pending for the last email's recipient cohort.
 */
export function buildLastEmailResultsSummary(input: {
  campaign: LastEmailCampaignRecord;
  events: AdminEvent[];
  participations: AdminEventParticipation[];
  respondents: EventRespondent[];
  prospects: RsvpProspectSlice[];
  yesLimit?: number;
}): LastEmailResultsSummary {
  const { campaign } = input;
  const yesLimit = input.yesLimit ?? 12;
  const event = resolveEventForCampaign(campaign, input.events);
  const recipientSet = new Set(uniqEmails(campaign.recipientEmails));
  const hasRecipientList = recipientSet.size > 0;

  const base = {
    templateKey: campaign.templateKey,
    templateLabel: campaign.templateLabel,
    sentAt: campaign.sentAt,
    recipientCount: Math.max(campaign.recipientCount, recipientSet.size),
    eventId: event?.id ?? campaign.eventId,
    eventSlug: event?.slug ?? campaign.eventSlug,
    eventTitle: event?.title ?? campaign.eventTitle,
    source: campaign.source,
  };

  if (!event) {
    return {
      ...base,
      responseMode: "none",
      yes: 0,
      no: 0,
      other: 0,
      pending: base.recipientCount,
      yesGuests: [],
    };
  }

  const mode: "interest" | "rsvp" =
    event.responseMode === "interest" ? "interest" : "rsvp";

  if (mode === "interest") {
    const sets = computeInterestRsvpEmailSets({
      eventSlug: event.slug,
      eventId: event.id,
      respondents: input.respondents.filter((r) => r.eventId === event.id),
      prospects: input.prospects,
      contactedParticipationEmails: input.participations
        .filter((p) => p.eventId === event.id && Boolean(p.saveTheDateSentAt))
        .map((p) => normalizeEmail(p.email))
        .filter((e) => e.includes("@")),
    });

    const cohort = hasRecipientList
      ? recipientSet
      : sets.contactedEmails.size > 0
        ? sets.contactedEmails
        : new Set(
            input.participations
              .filter((p) => p.eventId === event.id && Boolean(p.saveTheDateSentAt))
              .map((p) => normalizeEmail(p.email))
              .filter((e) => e.includes("@")),
          );

    let yes = 0;
    let no = 0;
    let other = 0;
    let pending = 0;
    const yesGuests: NextEventRsvpYesGuest[] = [];

    for (const email of cohort) {
      if (sets.yesEmails.has(email)) {
        yes += 1;
        const guest = sets.yesGuestsByEmail.get(email);
        if (guest) yesGuests.push(guest);
      } else if (sets.noEmails.has(email)) {
        no += 1;
      } else if (sets.otherEmails.has(email)) {
        other += 1;
      } else {
        pending += 1;
      }
    }

    return {
      ...base,
      recipientCount: Math.max(base.recipientCount, cohort.size),
      responseMode: "interest",
      yes,
      no,
      other,
      pending,
      sansReponseListName: interestSansReponseListName(event.slug),
      yesGuests: yesGuests.slice(0, yesLimit),
    };
  }

  const guests = input.participations.filter(
    (p) => p.eventId === event.id && !isOrganizerParticipation(p),
  );
  const cohortParts = hasRecipientList
    ? guests.filter((p) => recipientSet.has(normalizeEmail(p.email)))
    : guests.filter((p) => Boolean(p.calendarInviteSentAt || p.saveTheDateSentAt));

  const yesParts = cohortParts.filter(
    (p) => p.status === "attending" || p.status === "confirmed",
  );
  const noParts = cohortParts.filter((p) => p.status === "not_attending");
  const pendingParts = cohortParts.filter(
    (p) => p.status === "invited" || p.status === "waitlist",
  );

  return {
    ...base,
    recipientCount: Math.max(base.recipientCount, cohortParts.length),
    responseMode: "rsvp",
    yes: yesParts.length,
    no: noParts.length,
    other: 0,
    pending: pendingParts.length,
    yesGuests: yesParts.slice(0, yesLimit).map((p) => ({
      id: p.id,
      fullName: p.fullName?.trim() || p.email || "Sans nom",
      email: p.email ?? "",
      company: p.companyName?.trim() || "",
    })),
  };
}
