import { createProspectList } from "@/lib/prospects/lists-store";
import {
  findProspectByEmail,
  listProspects,
  updateProspect,
  upsertProspect,
} from "@/lib/prospects/store";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  applyInterestListMembership,
  interestProspectListNames,
  interestSansReponseListName,
  isStdCampaignListForSlug,
  type InterestListPair,
} from "@/lib/events/interest-prospect-lists";
import type { ProspectStatus } from "@/lib/types/prospects";
import { prospectStatusFromInterest } from "@/lib/prospects/status-from-interest";
import type { EventInterestResponse, WaitlistRegistration } from "@/lib/types/events";

export {
  applyInterestListMembership,
  interestProspectListNames,
  type InterestListPair,
} from "@/lib/events/interest-prospect-lists";

function uniqStrings(values: string[]): string[] {
  return [...new Set(values.map((t) => t.trim()).filter(Boolean))];
}

function prefer(incoming: string | undefined, existing: string | undefined): string {
  const i = (incoming ?? "").trim();
  if (i) return i;
  return (existing ?? "").trim();
}

function interestNoteLine(input: {
  interestResponse: EventInterestResponse;
  expectations?: string | null;
  declineReason?: string | null;
  declineReasonOther?: string | null;
  ideasComment?: string | null;
}): string {
  const bits = [`STD réponse: ${input.interestResponse.toUpperCase()}`];
  if (input.expectations?.trim()) bits.push(`attentes: ${input.expectations.trim()}`);
  if (input.declineReason) bits.push(`motif: ${input.declineReason}`);
  if (input.declineReasonOther?.trim()) bits.push(input.declineReasonOther.trim());
  if (input.ideasComment?.trim()) bits.push(`idée: ${input.ideasComment.trim()}`);
  return bits.join(" · ");
}

function mergeNotes(existing: string | undefined, line: string): string {
  const prev = (existing ?? "").trim();
  if (!prev) return line;
  if (prev.includes(line)) return prev;
  const withoutOld = prev
    .split("\n")
    .filter((row) => !row.trim().toLowerCase().startsWith("std réponse:"))
    .join("\n")
    .trim();
  return withoutOld ? `${line}\n${withoutOld}` : line;
}

const PROSPECT_NO_STATUSES = new Set<ProspectStatus>([
  "no_not_available",
  "no_not_interested",
]);

function listKeyMatch(lists: string[] | undefined, target: string): boolean {
  const key = target.trim().toLowerCase();
  return (lists ?? []).some((l) => l.trim().toLowerCase() === key);
}

/**
 * Backfill: prospects still on SHORTLIST (or other STD campagne lists) but already
 * OUI/NON or CRM won/no → move off shortlist into the right playlist.
 */
export async function reconcileAnsweredStdProspectLists(
  eventSlug: string,
): Promise<{ scanned: number; updated: number }> {
  const lists = interestProspectListNames(eventSlug);
  const prospects = await listProspects({ limit: 5000 });
  let scanned = 0;
  let updated = 0;

  for (const p of prospects) {
    const onStdCampaign = (p.lists ?? []).some((l) =>
      isStdCampaignListForSlug(l, eventSlug),
    );
    const onOui = listKeyMatch(p.lists, lists.yes);
    const onNon = listKeyMatch(p.lists, lists.noOther);
    if (!onStdCampaign && !onOui && !onNon) continue;

    scanned += 1;
    let interestResponse: "yes" | "no" | null = null;
    if (onOui || p.status === "won") interestResponse = "yes";
    else if (onNon || PROSPECT_NO_STATUSES.has(p.status)) interestResponse = "no";

    if (!interestResponse) continue;

    const nextLists = applyInterestListMembership(p.lists, lists, interestResponse);
    const same =
      nextLists.length === (p.lists ?? []).length &&
      nextLists.every((l) => (p.lists ?? []).includes(l));
    if (same) continue;

    const patched = await updateProspect(p.id, { lists: nextLists });
    if (patched) updated += 1;
  }

  return { scanned, updated };
}

export async function ensureInterestProspectLists(
  eventSlug: string,
): Promise<InterestListPair> {
  const lists = interestProspectListNames(eventSlug);
  await createProspectList(lists.yes);
  await createProspectList(lists.noOther);
  await createProspectList(interestSansReponseListName(eventSlug));
  return lists;
}

/**
 * Soft sync: never throws. Puts the respondent on OUI or NON/AUTRE list
 * (and removes them from the other). Status follows the STD answer.
 */
export async function syncInterestRespondentToProspectLists(input: {
  eventSlug: string;
  email: string;
  fullName: string;
  company?: string;
  phone?: string;
  position?: string;
  interestResponse: EventInterestResponse;
  expectations?: string | null;
  declineReason?: string | null;
  declineReasonOther?: string | null;
  ideasComment?: string | null;
  waitlist?: Pick<
    WaitlistRegistration,
    "sector" | "city" | "linkedinUrl" | "source" | "tags"
  > | null;
  logPrefix?: string;
}): Promise<{ ok: boolean; action?: "created" | "merged"; list?: string; skipped?: boolean }> {
  const logPrefix = input.logPrefix ?? "[interest-lists]";
  if (!isFirebaseAdminConfigured()) {
    return { ok: false, skipped: true };
  }

  const email = input.email?.trim() ?? "";
  if (!email.includes("@")) {
    console.warn(`${logPrefix} skip — missing email`);
    return { ok: false, skipped: true };
  }

  try {
    const lists = await ensureInterestProspectLists(input.eventSlug);
    const targetList =
      input.interestResponse === "yes" ? lists.yes : lists.noOther;
    const noteLine = interestNoteLine(input);
    const existing = await findProspectByEmail(email);
    const status = prospectStatusFromInterest({
      interestResponse: input.interestResponse,
      declineReason: input.declineReason,
      existingStatus: existing?.status,
    });

    if (existing) {
      const updated = await updateProspect(existing.id, {
        fullName: prefer(input.fullName, existing.fullName),
        company: prefer(input.company, existing.company),
        phone: prefer(input.phone, existing.phone),
        position: prefer(input.position, existing.position),
        sector: prefer(input.waitlist?.sector, existing.sector),
        city: prefer(input.waitlist?.city, existing.city),
        linkedin: prefer(input.waitlist?.linkedinUrl, existing.linkedin),
        lists: applyInterestListMembership(existing.lists, lists, input.interestResponse),
        tags: uniqStrings([
          ...(existing.tags ?? []),
          "save-the-date",
          input.interestResponse,
          ...(input.waitlist?.tags ?? []),
        ]),
        notes: mergeNotes(existing.notes, noteLine),
        ...(status ? { status } : {}),
      });
      if (!updated) {
        console.warn(`${logPrefix} update failed`, email);
        return { ok: false };
      }
      return { ok: true, action: "merged", list: targetList };
    }

    const result = await upsertProspect(
      {
        email,
        fullName: input.fullName,
        company: input.company,
        phone: input.phone,
        position: input.position,
        sector: input.waitlist?.sector,
        city: input.waitlist?.city,
        linkedin: input.waitlist?.linkedinUrl,
        lists: [targetList],
        tags: uniqStrings([
          "save-the-date",
          input.interestResponse,
          ...(input.waitlist?.tags ?? []),
        ]),
        notes: noteLine,
        status: status ?? "to_follow",
        source: input.waitlist?.source?.trim() || `interest:${input.eventSlug}`,
      },
      { source: `interest:${input.eventSlug}` },
    );

    if (!result.ok) {
      console.warn(`${logPrefix} upsert failed`, result.error);
      return { ok: false };
    }
    return { ok: true, action: result.action, list: targetList };
  } catch (error) {
    console.error(`${logPrefix} failed:`, error);
    return { ok: false };
  }
}
