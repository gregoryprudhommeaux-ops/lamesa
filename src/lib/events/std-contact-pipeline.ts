/**
 * STD / invitation contact pipeline for one event.
 *
 * Lists (exclusive destination once answered):
 * - SHORTLIST / campagne → pas encore (ou plus) dans OUI/NON/SANS RÉPONSE
 * - SANS RÉPONSE → contacté (STD ou invitation), pas encore de réponse → relançable
 * - OUI → inscrit d’intérêt ; plus de STD / relance STD ; plus tard invitation ticket
 * - NON/AUTRE → refus pour CET événement ; plus aucun outreach de cet événement
 *
 * Generic cold (hors template événement) : un contact approché mais pas inscrit
 * plateforme peut être recontacté, sauf do_not_contact.
 */
import {
  extractStdEventSlugsFromLists,
  interestProspectListNames,
  interestSansReponseListName,
  isStdCampaignListForSlug,
} from "@/lib/events/interest-prospect-lists";
import {
  eventSlugFromOutreachTemplateKey,
  isStdRelanceTemplateKey,
} from "@/lib/events/std-outreach-templates";
import type { ProspectStatus } from "@/lib/types/prospects";

export type StdPipelineBucket = "shortlist" | "sans_reponse" | "oui" | "non" | "none";

export type OutreachTemplateKind =
  | "std_initial"
  | "std_relance"
  | "ticket_invite"
  | "generic";

const GLOBAL_BLOCK_STATUSES = new Set<ProspectStatus>(["do_not_contact"]);

const EVENT_ANSWERED_STATUSES = new Set<ProspectStatus>([
  "won",
  "no_not_available",
  "no_not_interested",
]);

function listKeyMatch(lists: string[] | undefined, target: string): boolean {
  const key = target.trim().toLowerCase();
  return (lists ?? []).some((l) => l.trim().toLowerCase() === key);
}

/** Official ticket / payment invite after OUI — not STD. */
export function isTicketInviteTemplateKey(templateKey: string): boolean {
  const key = templateKey.trim().toLowerCase();
  if (!key) return false;
  return (
    key.includes("ticket") ||
    key.includes("paiement") ||
    key.includes("reglement") ||
    key.includes("règlement") ||
    key.includes("invitation_officielle") ||
    key.includes("official_invite")
  );
}

export function classifyOutreachTemplate(templateKey: string): OutreachTemplateKind {
  const key = templateKey.trim();
  if (!key) return "generic";
  if (isTicketInviteTemplateKey(key)) return "ticket_invite";
  if (isStdRelanceTemplateKey(key)) return "std_relance";
  if (key === "save_the_date" || eventSlugFromOutreachTemplateKey(key)) {
    return "std_initial";
  }
  return "generic";
}

export function resolveEventSlugForTemplate(
  templateKey: string,
  lists?: string[],
): string | null {
  const fromKey = eventSlugFromOutreachTemplateKey(templateKey);
  if (fromKey) return fromKey;
  const kind = classifyOutreachTemplate(templateKey);
  if (kind === "std_relance" || kind === "ticket_invite") {
    return extractStdEventSlugsFromLists(lists)[0] ?? null;
  }
  if (templateKey.trim().toLowerCase() === "save_the_date") {
    return extractStdEventSlugsFromLists(lists)[0] ?? null;
  }
  return null;
}

/** Which STD bucket a prospect is in for a given event slug. */
export function stdPipelineBucketForProspect(
  prospect: { status?: ProspectStatus; lists?: string[] },
  eventSlug: string,
): StdPipelineBucket {
  const slug = eventSlug.trim();
  if (!slug) return "none";
  const pair = interestProspectListNames(slug);
  const sans = interestSansReponseListName(slug);

  if (listKeyMatch(prospect.lists, pair.yes) || prospect.status === "won") {
    // Prefer explicit NON list over stale won if both somehow present.
    if (listKeyMatch(prospect.lists, pair.noOther)) return "non";
    return "oui";
  }
  if (
    listKeyMatch(prospect.lists, pair.noOther) ||
    prospect.status === "no_not_available" ||
    prospect.status === "no_not_interested"
  ) {
    return "non";
  }
  if (listKeyMatch(prospect.lists, sans)) return "sans_reponse";
  if ((prospect.lists ?? []).some((l) => isStdCampaignListForSlug(l, slug))) {
    return "shortlist";
  }
  return "none";
}

export type EligibilityInput = {
  sentTemplateKeys?: string[];
  status?: ProspectStatus;
  lists?: string[];
};

/**
 * Can this prospect receive this template?
 * Encodes the dinner ops rules (OUI/NON exclusive, sans réponse relançable, etc.).
 */
export function isEligibleForStdPipelineCampaign(
  prospect: EligibilityInput,
  templateKey: string,
): boolean {
  const key = templateKey.trim();
  if (!key) return true;

  const status = prospect.status;
  if (status && GLOBAL_BLOCK_STATUSES.has(status)) return false;

  const kind = classifyOutreachTemplate(key);
  const slug = resolveEventSlugForTemplate(key, prospect.lists);
  const alreadySentExact = (prospect.sentTemplateKeys ?? []).includes(key);

  if (kind === "generic") {
    if (alreadySentExact) return false;
    // Approached / pending CRM statuses stay recontactable for generic cold.
    if (status && EVENT_ANSWERED_STATUSES.has(status)) return false;
    return true;
  }

  if (!slug) {
    // Ticket / relance without resolvable event: be conservative.
    if (kind === "ticket_invite") {
      return prospect.status === "won" || Boolean(prospect.lists?.some((l) => /—\s*oui$/i.test(l)));
    }
    if (alreadySentExact && kind === "std_initial") return false;
    return true;
  }

  const bucket = stdPipelineBucketForProspect(prospect, slug);

  if (kind === "ticket_invite") {
    // Only OUI (already interested / registered for the dinner).
    return bucket === "oui";
  }

  // STD initial + STD relance: never OUI or NON for this event.
  if (bucket === "oui" || bucket === "non") return false;
  if (status && EVENT_ANSWERED_STATUSES.has(status)) return false;

  if (kind === "std_initial") {
    // One initial blast: already sent this key, or already in pending pool.
    if (alreadySentExact) return false;
    if (bucket === "sans_reponse") return false;
    return true;
  }

  // std_relance: may relaunch until we get a response (same key allowed again).
  if (bucket === "sans_reponse" || bucket === "shortlist") return true;
  if (
    status === "no_response" ||
    status === "to_follow" ||
    status === "contacted" ||
    status === "to_contact"
  ) {
    return true;
  }
  return false;
}
