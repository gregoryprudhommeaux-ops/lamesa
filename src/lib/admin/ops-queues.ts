import { countsAsInvitation } from "@/lib/admin/member-engagement";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import {
  computeProfileCompletionPercent,
  isExpressSignup,
} from "@/lib/member/profile-completion";
import { resolveOpsPriority } from "@/lib/constants/ops-priority";
import type { AdminEventParticipation, WaitlistRegistration } from "@/lib/types/events";

export type OpsQueueKey =
  | "incomplete"
  | "neverInvited"
  | "review"
  | "priority"
  | "noShow";

export type OpsQueueMember = {
  id: string;
  fullName: string;
  email: string;
  company: string;
  city: string;
  opsPriority: string;
  opsTags: string[];
  reason: string;
};

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

function invitationCountByMember(
  members: WaitlistRegistration[],
  participations: AdminEventParticipation[],
): Map<string, number> {
  const byEmail = new Map<string, string>();
  for (const m of members) {
    const email = normalizeEmail(m.email);
    if (email) byEmail.set(email, m.id);
  }

  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.id, 0);

  for (const p of participations) {
    if (isOrganizerParticipation(p)) continue;
    if (!countsAsInvitation(p.status)) continue;
    let memberId = p.contactId?.trim() || "";
    if (!memberId || !counts.has(memberId)) {
      memberId = byEmail.get(normalizeEmail(p.email)) ?? "";
    }
    if (!memberId || !counts.has(memberId)) continue;
    counts.set(memberId, (counts.get(memberId) ?? 0) + 1);
  }
  return counts;
}

function toQueueMember(r: WaitlistRegistration, reason: string): OpsQueueMember {
  return {
    id: r.id,
    fullName: r.fullName ?? "",
    email: r.email ?? "",
    company: r.company ?? "",
    city: r.city ?? "",
    opsPriority: resolveOpsPriority(r.opsPriority),
    opsTags: Array.isArray(r.opsTags) ? r.opsTags : [],
    reason,
  };
}

const QUEUE_LIMIT = 12;

/**
 * Build admin cockpit queues from active waitlist + participations.
 */
export function buildOpsQueues(input: {
  members: WaitlistRegistration[];
  participations: AdminEventParticipation[];
}): Record<OpsQueueKey, OpsQueueMember[]> {
  const invites = invitationCountByMember(input.members, input.participations);

  const incomplete: OpsQueueMember[] = [];
  const neverInvited: OpsQueueMember[] = [];
  const review: OpsQueueMember[] = [];
  const priority: OpsQueueMember[] = [];
  const noShow: OpsQueueMember[] = [];

  for (const r of input.members) {
    const percent = computeProfileCompletionPercent(r);
    const priorityBand = resolveOpsPriority(r.opsPriority);
    const tags = (r.opsTags ?? []).map((t) => t.toLowerCase());

    if (isExpressSignup(r) || percent < 50) {
      incomplete.push(
        toQueueMember(
          r,
          isExpressSignup(r) ? "Inscription express" : `Profil ${percent}%`,
        ),
      );
    }

    if ((invites.get(r.id) ?? 0) === 0 && percent >= 50 && !isExpressSignup(r)) {
      neverInvited.push(toQueueMember(r, "Jamais invité"));
    }

    if (priorityBand === "review") {
      review.push(toQueueMember(r, "Marqué à revoir"));
    }
    if (priorityBand === "priority") {
      priority.push(toQueueMember(r, "À prioriser"));
    }
    if (tags.includes("no-show")) {
      noShow.push(toQueueMember(r, "No-show"));
    }
  }

  const createdAt = new Map(input.members.map((m) => [m.id, m.createdAt ?? ""]));
  const sortQueue = (rows: OpsQueueMember[]) =>
    [...rows]
      .sort(
        (a, b) =>
          new Date(createdAt.get(b.id) ?? 0).getTime() -
          new Date(createdAt.get(a.id) ?? 0).getTime(),
      )
      .slice(0, QUEUE_LIMIT);

  return {
    incomplete: sortQueue(incomplete),
    neverInvited: sortQueue(neverInvited),
    review: sortQueue(review),
    priority: sortQueue(priority),
    noShow: sortQueue(noShow),
  };
}
