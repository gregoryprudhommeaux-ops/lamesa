/**
 * Track the most recent outreach email blast and compute OUI/NON/pending
 * for its recipient cohort (dashboard cockpit).
 */
import {
  computeInterestRsvpEmailSets,
  countConfirmedParticipations,
  countInviteSentNotPaid,
  enrichYesGuestsWithSeats,
  type NextEventRsvpYesGuest,
  type RsvpProspectSlice,
} from "@/lib/admin/next-event-rsvp";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { interestSansReponseListName } from "@/lib/events/interest-prospect-lists";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { eventSlugFromOutreachTemplateKey, isRsvpButtonCampaignKey } from "@/lib/events/std-outreach-templates";
import { templateLabel } from "@/lib/email/template-defaults";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { isExpressSignup } from "@/lib/member/profile-completion";
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
  | "places_available"
  | "inferred";

/** Outcome of one person who received the blast. */
export type EmailRecipientOutcome =
  | "confirmed"
  | "yes"
  | "invite_sent"
  | "no"
  | "other"
  | "registered"
  | "pending";

export type EmailCampaignRecipientRow = {
  id: string;
  email: string;
  fullName: string;
  company: string;
  outcome: EmailRecipientOutcome;
  /** Waitlist signup flavour when outcome is registered / also on Mesa. */
  signupKind?: "express" | "complete" | null;
};

export type LastEmailCampaignRecord = {
  id?: string;
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
  id?: string;
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
  /** Places confirmées / payées parmi la cohorte (ou l’événement). */
  confirmed: number;
  /** Invitation formelle envoyée, pas encore payée. */
  inviteSent: number;
  /** Destinataires devenus membres waitlist (inscrits plateforme). */
  registered: number;
  registeredExpress: number;
  registeredComplete: number;
  /** (oui+non+autre) / envoyés · 0–100 */
  responseRate: number;
  /** oui / envoyés · 0–100 */
  yesRate: number;
  /** confirmés / envoyés · 0–100 */
  confirmedRate: number;
  sansReponseListName?: string;
  yesGuests: NextEventRsvpYesGuest[];
  noGuests: NextEventRsvpYesGuest[];
  /** Cohort contacted by this blast, with per-person outcome. */
  recipients: EmailCampaignRecipientRow[];
  source: LastEmailCampaignSource;
};

export type EmailCampaignHistoryRow = {
  id: string;
  templateKey: string;
  templateLabel: string;
  sentAt: string;
  recipientCount: number;
  yes: number;
  no: number;
  pending: number;
  confirmed: number;
  registered: number;
  responseRate: number;
  yesRate: number;
  confirmedRate: number;
  eventTitle: string | null;
  eventId: string | null;
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

export function pctRate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

const OUTCOME_SORT: Record<EmailRecipientOutcome, number> = {
  confirmed: 0,
  invite_sent: 1,
  yes: 2,
  registered: 3,
  no: 4,
  other: 5,
  pending: 6,
};

export function toEmailCampaignHistoryRow(
  summary: LastEmailResultsSummary,
  id = summary.id ?? summary.templateKey,
): EmailCampaignHistoryRow {
  return {
    id,
    templateKey: summary.templateKey,
    templateLabel: summary.templateLabel,
    sentAt: summary.sentAt,
    recipientCount: summary.recipientCount,
    yes: summary.yes,
    no: summary.no + summary.other,
    pending: summary.pending,
    confirmed: summary.confirmed,
    registered: summary.registered,
    responseRate: summary.responseRate,
    yesRate: summary.yesRate,
    confirmedRate: summary.confirmedRate,
    eventTitle: summary.eventTitle,
    eventId: summary.eventId,
  };
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
    sourceRaw === "places_available" ||
    sourceRaw === "inferred"
      ? sourceRaw
      : "inferred";

  const eventSlug =
    String(data.eventSlug ?? "").trim() ||
    eventSlugFromOutreachTemplateKey(templateKey) ||
    null;

  return {
    templateKey,
    templateLabel:
      String(data.templateLabel ?? "").trim() ||
      templateLabel(
        (templateKey.includes(":")
          ? templateKey.split(":")[0]
          : templateKey) as EmailTemplateKey,
      ),
    sentAt,
    recipientCount,
    recipientEmails,
    eventSlug,
    eventId: String(data.eventId ?? "").trim() || null,
    eventTitle: String(data.eventTitle ?? "").trim() || null,
    source,
    updatedAt: String(data.updatedAt ?? sentAt),
    id: typeof data.id === "string" ? data.id : undefined,
  };
}

/** Persist the latest blast pointer + append to campaign history. Soft-fails. */
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
    const labelKey = (
      templateKey.includes(":") ? templateKey.split(":")[0]! : templateKey
    ) as EmailTemplateKey;
    const record: LastEmailCampaignRecord = {
      templateKey,
      templateLabel:
        input.templateLabel?.trim() || templateLabel(labelKey),
      sentAt: input.sentAt?.trim() || now,
      recipientCount: emails.length,
      recipientEmails: emails.slice(0, MAX_STORED_RECIPIENT_EMAILS),
      eventSlug,
      eventId: input.eventId?.trim() || null,
      eventTitle: input.eventTitle?.trim() || null,
      source: input.source,
      updatedAt: now,
    };
    const db = getAdminFirestore();
    await db
      .collection(COLLECTIONS.ops)
      .doc(LAST_EMAIL_CAMPAIGN_DOC_ID)
      .set(record, { merge: true });
    // History archive (learning / performance over time).
    await db.collection(COLLECTIONS.emailCampaigns).add(record);
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

/** Recent blasts for the performance history table (newest first). */
export async function loadRecentEmailCampaigns(
  limit = 8,
): Promise<LastEmailCampaignRecord[]> {
  try {
    if (!isFirebaseAdminConfigured()) return [];
    const snap = await getAdminFirestore()
      .collection(COLLECTIONS.emailCampaigns)
      .orderBy("sentAt", "desc")
      .limit(Math.min(Math.max(limit, 1), 20))
      .get();
    return snap.docs
      .map((d) =>
        normalizeLastEmailCampaignRecord({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        }),
      )
      .filter((r): r is LastEmailCampaignRecord => Boolean(r));
  } catch (error) {
    // Missing index / empty collection — soft-fail.
    console.warn("[last-email-campaign] history load failed", error);
    return [];
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

/** Infer last “places available” blast from participation stamps. */
export function inferLastPlacesAvailableCampaign(
  events: AdminEvent[],
  participations: AdminEventParticipation[],
): LastEmailCampaignRecord | null {
  let bestMs = 0;
  let bestEventId = "";
  for (const p of participations) {
    if (isOrganizerParticipation(p)) continue;
    const stamp = p.placesAvailableSentAt;
    if (!stamp) continue;
    const ms = new Date(stamp).getTime();
    if (!Number.isFinite(ms) || ms < bestMs) continue;
    bestMs = ms;
    bestEventId = p.eventId;
  }
  if (!bestEventId || bestMs <= 0) return null;
  const event = events.find((e) => e.id === bestEventId);
  if (!event) return null;

  // Wave: same event, stamps within 12h of the latest.
  const emails = uniqEmails(
    participations
      .filter((p) => p.eventId === bestEventId && !isOrganizerParticipation(p))
      .filter((p) => {
        const ms = p.placesAvailableSentAt
          ? new Date(p.placesAvailableSentAt).getTime()
          : NaN;
        return Number.isFinite(ms) && bestMs - ms <= INFER_WAVE_MS;
      })
      .map((p) => p.email ?? ""),
  );
  if (emails.length === 0) return null;

  return {
    templateKey: `places_available:${event.slug}`,
    templateLabel: templateLabel("places_available"),
    sentAt: new Date(bestMs).toISOString(),
    recipientCount: emails.length,
    recipientEmails: emails.slice(0, MAX_STORED_RECIPIENT_EMAILS),
    eventSlug: event.slug,
    eventId: event.id,
    eventTitle: event.title,
    source: "inferred",
    updatedAt: new Date(bestMs).toISOString(),
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
  const slug =
    campaign.eventSlug?.trim() ||
    eventSlugFromOutreachTemplateKey(campaign.templateKey) ||
    "";
  if (slug) {
    const key = slug.toLowerCase();
    return events.find((e) => e.slug.trim().toLowerCase() === key) ?? null;
  }
  return null;
}

export type WaitlistSignupSlice = {
  id?: string;
  email: string;
  fullName?: string;
  company?: string;
  source?: string | null;
  profileComplete?: boolean | null;
  createdAt?: string | null;
};

function signupKindForEmail(
  email: string,
  waitlistByEmail: Map<string, WaitlistSignupSlice>,
): "express" | "complete" | null {
  const row = waitlistByEmail.get(email);
  if (!row) return null;
  return isExpressSignup(row) ? "express" : "complete";
}

/**
 * Build OUI/NON/pending + per-recipient outcomes for a blast cohort.
 */
export function buildLastEmailResultsSummary(input: {
  campaign: LastEmailCampaignRecord;
  events: AdminEvent[];
  participations: AdminEventParticipation[];
  respondents: EventRespondent[];
  prospects: RsvpProspectSlice[];
  /** Active waitlist members keyed by normalized email (inscrits plateforme). */
  waitlistByEmail?: Map<string, WaitlistSignupSlice>;
  /** @deprecated prefer waitlistByEmail */
  waitlistEmails?: Set<string>;
  yesLimit?: number;
  recipientLimit?: number;
}): LastEmailResultsSummary {
  const { campaign } = input;
  const yesLimit = input.yesLimit ?? 40;
  const recipientLimit = input.recipientLimit ?? 120;
  const waitlistByEmail: Map<string, WaitlistSignupSlice> =
    input.waitlistByEmail ??
    new Map(
      [...(input.waitlistEmails ?? [])].map((email) => [
        email,
        {
          email,
          fullName: "",
          company: "",
          source: "",
          profileComplete: true,
        } satisfies WaitlistSignupSlice,
      ]),
    );
  const waitlistEmails = new Set(waitlistByEmail.keys());
  const event = resolveEventForCampaign(campaign, input.events);
  const recipientSet = new Set(uniqEmails(campaign.recipientEmails));
  const hasRecipientList = recipientSet.size > 0;
  const forceRsvp = isRsvpButtonCampaignKey(campaign.templateKey);

  const base = {
    id: campaign.id,
    templateKey: campaign.templateKey,
    templateLabel: campaign.templateLabel,
    sentAt: campaign.sentAt,
    recipientCount: Math.max(campaign.recipientCount, recipientSet.size),
    eventId: event?.id ?? campaign.eventId,
    eventSlug:
      event?.slug ??
      campaign.eventSlug ??
      eventSlugFromOutreachTemplateKey(campaign.templateKey),
    eventTitle: event?.title ?? campaign.eventTitle,
    source: campaign.source,
  };

  if (!event) {
    const recipients: EmailCampaignRecipientRow[] = [...recipientSet]
      .slice(0, recipientLimit)
      .map((email) => {
        const kind = signupKindForEmail(email, waitlistByEmail);
        return {
          id: email,
          email,
          fullName: waitlistByEmail.get(email)?.fullName?.trim() || email,
          company: waitlistByEmail.get(email)?.company?.trim() || "",
          outcome: kind ? ("registered" as const) : ("pending" as const),
          signupKind: kind,
        };
      });
    const registeredExpress = recipients.filter((r) => r.signupKind === "express").length;
    const registeredComplete = recipients.filter((r) => r.signupKind === "complete").length;
    const registered = registeredExpress + registeredComplete;
    return {
      ...base,
      responseMode: "none",
      yes: 0,
      no: 0,
      other: 0,
      pending: Math.max(0, base.recipientCount - registered),
      confirmed: 0,
      inviteSent: 0,
      registered,
      registeredExpress,
      registeredComplete,
      responseRate: pctRate(registered, base.recipientCount),
      yesRate: 0,
      confirmedRate: 0,
      yesGuests: [],
      noGuests: [],
      recipients,
    };
  }

  // Places available / formal invite: OUI/NON are RSVP clicks on participations.
  if (forceRsvp || event.responseMode !== "interest") {
    return buildRsvpButtonCampaignSummary({
      base,
      event,
      campaign,
      participations: input.participations,
      recipientSet,
      hasRecipientList,
      waitlistByEmail,
      waitlistEmails,
      yesLimit,
      recipientLimit,
      stampField: forceRsvp && campaign.templateKey.includes("places_available")
        ? "placesAvailableSentAt"
        : "calendarInviteSentAt",
    });
  }

  // Interest STD / CRM playlists path…
  const emailFilter = hasRecipientList ? recipientSet : undefined;
  const prospectByEmail = new Map<string, RsvpProspectSlice>();
  for (const p of input.prospects) {
    const email = normalizeEmail(p.email);
    if (email.includes("@")) prospectByEmail.set(email, p);
  }

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
  let registeredExpress = 0;
  let registeredComplete = 0;
  const yesGuestsRaw: NextEventRsvpYesGuest[] = [];
  const noGuests: NextEventRsvpYesGuest[] = [];
  const recipientsRaw: EmailCampaignRecipientRow[] = [];

  const yesGuestsEnriched = enrichYesGuestsWithSeats(
    [...sets.yesGuestsByEmail.values()],
    event.id,
    input.participations,
  );
  const seatByEmail = new Map(
    yesGuestsEnriched.map((g) => [normalizeEmail(g.email), g.seat ?? "oui"] as const),
  );

  for (const email of cohort) {
    const prospect = prospectByEmail.get(email);
    const guest = sets.yesGuestsByEmail.get(email);
    const wait = waitlistByEmail.get(email);
    const fullName =
      guest?.fullName ||
      prospect?.fullName?.trim() ||
      wait?.fullName?.trim() ||
      email;
    const company =
      guest?.company || prospect?.company?.trim() || wait?.company?.trim() || "";
    const id = guest?.id || prospect?.id || wait?.id || email;
    const kind = signupKindForEmail(email, waitlistByEmail);

    if (sets.yesEmails.has(email)) {
      yes += 1;
      if (guest) yesGuestsRaw.push(guest);
      const seat = seatByEmail.get(email) ?? "oui";
      const outcome: EmailRecipientOutcome =
        seat === "confirmed"
          ? "confirmed"
          : seat === "invite_sent"
            ? "invite_sent"
            : "yes";
      recipientsRaw.push({ id, email, fullName, company, outcome, signupKind: kind });
    } else if (sets.noEmails.has(email)) {
      no += 1;
      noGuests.push({ id, fullName, email, company });
      recipientsRaw.push({ id, email, fullName, company, outcome: "no", signupKind: kind });
    } else if (sets.otherEmails.has(email)) {
      other += 1;
      recipientsRaw.push({ id, email, fullName, company, outcome: "other", signupKind: kind });
    } else if (kind) {
      if (kind === "express") registeredExpress += 1;
      else registeredComplete += 1;
      recipientsRaw.push({
        id,
        email,
        fullName,
        company,
        outcome: "registered",
        signupKind: kind,
      });
    } else {
      pending += 1;
      recipientsRaw.push({ id, email, fullName, company, outcome: "pending", signupKind: null });
    }
  }

  const sent = Math.max(base.recipientCount, cohort.size);
  const confirmed = countConfirmedParticipations(
    event.id,
    input.participations,
    emailFilter ?? cohort,
  );
  const answered = yes + no + other;
  const registered = registeredExpress + registeredComplete;

  return {
    ...base,
    recipientCount: sent,
    responseMode: "interest",
    yes,
    no,
    other,
    pending,
    confirmed,
    inviteSent: countInviteSentNotPaid(
      event.id,
      input.participations,
      emailFilter ?? cohort,
    ),
    registered,
    registeredExpress,
    registeredComplete,
    responseRate: pctRate(answered, sent),
    yesRate: pctRate(yes, sent),
    confirmedRate: pctRate(confirmed, sent),
    sansReponseListName: interestSansReponseListName(event.slug),
    yesGuests: enrichYesGuestsWithSeats(
      yesGuestsRaw,
      event.id,
      input.participations,
    ).slice(0, yesLimit),
    noGuests: noGuests
      .sort((a, b) =>
        (a.fullName || a.email).localeCompare(b.fullName || b.email, "fr", {
          sensitivity: "base",
        }),
      )
      .slice(0, yesLimit),
    recipients: recipientsRaw
      .sort(
        (a, b) =>
          OUTCOME_SORT[a.outcome] - OUTCOME_SORT[b.outcome] ||
          a.fullName.localeCompare(b.fullName, "fr", { sensitivity: "base" }),
      )
      .slice(0, recipientLimit),
  };
}

function buildRsvpButtonCampaignSummary(input: {
  base: Omit<
    LastEmailResultsSummary,
    | "responseMode"
    | "yes"
    | "no"
    | "other"
    | "pending"
    | "confirmed"
    | "inviteSent"
    | "registered"
    | "registeredExpress"
    | "registeredComplete"
    | "responseRate"
    | "yesRate"
    | "confirmedRate"
    | "sansReponseListName"
    | "yesGuests"
    | "noGuests"
    | "recipients"
  >;
  event: AdminEvent;
  campaign: LastEmailCampaignRecord;
  participations: AdminEventParticipation[];
  recipientSet: Set<string>;
  hasRecipientList: boolean;
  waitlistByEmail: Map<string, WaitlistSignupSlice>;
  waitlistEmails: Set<string>;
  yesLimit: number;
  recipientLimit: number;
  stampField: "placesAvailableSentAt" | "calendarInviteSentAt";
}): LastEmailResultsSummary {
  const guests = input.participations.filter(
    (p) => p.eventId === input.event.id && !isOrganizerParticipation(p),
  );
  const stamped = guests.filter((p) => Boolean(p[input.stampField]));
  const cohortParts = input.hasRecipientList
    ? guests.filter((p) => input.recipientSet.has(normalizeEmail(p.email)))
    : stamped.length > 0
      ? stamped
      : guests.filter((p) =>
          input.recipientSet.size > 0
            ? input.recipientSet.has(normalizeEmail(p.email))
            : Boolean(p.placesAvailableSentAt || p.calendarInviteSentAt),
        );

  // If we have recipient emails but no participation rows yet, still list them.
  const cohortEmails =
    cohortParts.length > 0
      ? uniqEmails(cohortParts.map((p) => p.email ?? ""))
      : [...input.recipientSet];

  const partByEmail = new Map(
    cohortParts.map((p) => [normalizeEmail(p.email), p] as const),
  );

  let yes = 0;
  let no = 0;
  let pending = 0;
  let confirmed = 0;
  let inviteSent = 0;
  const yesGuests: NextEventRsvpYesGuest[] = [];
  const noGuests: NextEventRsvpYesGuest[] = [];
  const recipients: EmailCampaignRecipientRow[] = [];

  for (const email of cohortEmails) {
    const p = partByEmail.get(email);
    const wait = input.waitlistByEmail.get(email);
    const kind = signupKindForEmail(email, input.waitlistByEmail);
    const fullName =
      p?.fullName?.trim() || wait?.fullName?.trim() || email;
    const company = p?.companyName?.trim() || wait?.company?.trim() || "";
    const id = p?.id || wait?.id || email;

    if (p) {
      const status = normalizeParticipationStatus(p.status);
      if (status === "confirmed") {
        confirmed += 1;
        yes += 1;
        yesGuests.push({ id, fullName, email: p.email ?? email, company, seat: "confirmed" });
        recipients.push({
          id,
          email: p.email ?? email,
          fullName,
          company,
          outcome: "confirmed",
          signupKind: kind,
        });
        continue;
      }
      if (status === "attending") {
        yes += 1;
        yesGuests.push({ id, fullName, email: p.email ?? email, company, seat: "invite_sent" });
        recipients.push({
          id,
          email: p.email ?? email,
          fullName,
          company,
          outcome: "yes",
          signupKind: kind,
        });
        continue;
      }
      if (status === "not_attending") {
        no += 1;
        noGuests.push({ id, fullName, email: p.email ?? email, company });
        recipients.push({
          id,
          email: p.email ?? email,
          fullName,
          company,
          outcome: "no",
          signupKind: kind,
        });
        continue;
      }
      if (p.calendarInviteSentAt && status === "invited") {
        inviteSent += 1;
      }
    }

    pending += 1;
    recipients.push({
      id,
      email: p?.email ?? email,
      fullName,
      company,
      outcome: "pending",
      signupKind: kind,
    });
  }

  const registeredExpress = recipients.filter((r) => r.signupKind === "express").length;
  const registeredComplete = recipients.filter((r) => r.signupKind === "complete").length;
  const registered = registeredExpress + registeredComplete;
  const sent = Math.max(input.base.recipientCount, cohortEmails.length);
  const answered = yes + no;

  return {
    ...input.base,
    recipientCount: sent,
    responseMode: "rsvp",
    yes,
    no,
    other: 0,
    pending,
    confirmed,
    inviteSent,
    registered,
    registeredExpress,
    registeredComplete,
    responseRate: pctRate(answered, sent),
    yesRate: pctRate(yes, sent),
    confirmedRate: pctRate(confirmed, sent),
    yesGuests: yesGuests
      .sort(
        (a, b) =>
          (a.seat === "confirmed" ? 0 : 1) - (b.seat === "confirmed" ? 0 : 1) ||
          (a.fullName || a.email).localeCompare(b.fullName || b.email, "fr", {
            sensitivity: "base",
          }),
      )
      .slice(0, input.yesLimit),
    noGuests: noGuests
      .sort((a, b) =>
        (a.fullName || a.email).localeCompare(b.fullName || b.email, "fr", {
          sensitivity: "base",
        }),
      )
      .slice(0, input.yesLimit),
    recipients: recipients
      .sort(
        (a, b) =>
          OUTCOME_SORT[a.outcome] - OUTCOME_SORT[b.outcome] ||
          a.fullName.localeCompare(b.fullName, "fr", { sensitivity: "base" }),
      )
      .slice(0, input.recipientLimit),
  };
}
