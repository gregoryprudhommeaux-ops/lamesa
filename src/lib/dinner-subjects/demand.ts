import type {
  DinnerSubject,
  DinnerSubjectInterest,
  WaitlistRegistration,
} from "@/lib/types/events";
import { subjectTimingBucket, type SubjectTimingBucket } from "@/lib/dinner-subjects/period";

export type SubjectDemandCounts = {
  declared: number;
  pending: number;
  validated: number;
  rejected: number;
};

export type SubjectDemandRow = {
  subject: DinnerSubject;
  timing: SubjectTimingBucket;
  counts: SubjectDemandCounts;
};

export type PendingSubjectValidation = {
  memberId: string;
  fullName: string;
  email: string;
  company: string;
  sector: string;
  position: string;
  subjectId: string;
  subjectTitle: string;
  periodMonth?: string;
  city?: string;
  declaredAt: string;
};

/** Free-text theme wish from /themes or inscription (`dinnerThemesInterest`). */
export type CommunityThemeSuggestion = {
  memberId: string;
  fullName: string;
  email: string;
  company: string;
  text: string;
  updatedAt: string;
};

function emptyCounts(): SubjectDemandCounts {
  return { declared: 0, pending: 0, validated: 0, rejected: 0 };
}

function bump(counts: SubjectDemandCounts, validation: DinnerSubjectInterest["validation"]) {
  counts.declared += 1;
  if (validation === "pending") counts.pending += 1;
  else if (validation === "validated") counts.validated += 1;
  else counts.rejected += 1;
}

/**
 * Aggregate waitlist subject interests against the catalog.
 * Soft-deleted members should be filtered by the caller.
 */
export function aggregateSubjectDemand(
  subjects: DinnerSubject[],
  members: Array<
    Pick<WaitlistRegistration, "id" | "dinnerSubjectInterests">
  >,
  now = new Date(),
): SubjectDemandRow[] {
  const byId = new Map<string, SubjectDemandCounts>();
  for (const subject of subjects) {
    byId.set(subject.id, emptyCounts());
  }

  for (const member of members) {
    for (const interest of member.dinnerSubjectInterests ?? []) {
      const counts = byId.get(interest.subjectId);
      if (!counts) continue;
      bump(counts, interest.validation);
    }
  }

  return subjects
    .map((subject) => ({
      subject,
      timing: subjectTimingBucket(subject.periodMonth, now),
      counts: byId.get(subject.id) ?? emptyCounts(),
    }))
    .sort((a, b) => {
      if (b.counts.validated !== a.counts.validated) {
        return b.counts.validated - a.counts.validated;
      }
      if (b.counts.pending !== a.counts.pending) {
        return b.counts.pending - a.counts.pending;
      }
      if (a.subject.periodMonth !== b.subject.periodMonth) {
        return a.subject.periodMonth.localeCompare(b.subject.periodMonth);
      }
      return a.subject.title.localeCompare(b.subject.title, "fr");
    });
}

/** Members with at least one pending catalog interest — admin coherence queue. */
export function listPendingSubjectValidations(
  members: Array<
    Pick<
      WaitlistRegistration,
      | "id"
      | "fullName"
      | "email"
      | "company"
      | "sector"
      | "position"
      | "dinnerSubjectInterests"
    >
  >,
): PendingSubjectValidation[] {
  const rows: PendingSubjectValidation[] = [];
  for (const member of members) {
    for (const interest of member.dinnerSubjectInterests ?? []) {
      if (interest.validation !== "pending") continue;
      rows.push({
        memberId: member.id,
        fullName: member.fullName,
        email: member.email,
        company: member.company,
        sector: member.sector,
        position: member.position,
        subjectId: interest.subjectId,
        subjectTitle: interest.title,
        periodMonth: interest.periodMonth,
        city: interest.city,
        declaredAt: interest.declaredAt,
      });
    }
  }
  return rows.sort((a, b) => a.declaredAt.localeCompare(b.declaredAt));
}

/**
 * Free-text “what themes would you like to see?” from members.
 * Newest first — soft-deleted members should be filtered by the caller.
 */
export function listCommunityThemeSuggestions(
  members: Array<
    Pick<
      WaitlistRegistration,
      "id" | "fullName" | "email" | "company" | "dinnerThemesInterest" | "updatedAt"
    >
  >,
  limit = 40,
): CommunityThemeSuggestion[] {
  const rows: CommunityThemeSuggestion[] = [];
  for (const member of members) {
    const text = member.dinnerThemesInterest?.trim() ?? "";
    if (!text) continue;
    rows.push({
      memberId: member.id,
      fullName: member.fullName?.trim() || "—",
      email: member.email,
      company: member.company?.trim() || "",
      text: text.slice(0, 2000),
      updatedAt: member.updatedAt || "",
    });
  }
  return rows
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, Math.max(1, Math.min(limit, 100)));
}
