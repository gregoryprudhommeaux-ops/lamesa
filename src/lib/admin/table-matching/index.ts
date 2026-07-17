import type { AdminEvent, AdminEventParticipation, WaitlistRegistration } from "@/lib/types/events";
import { generateTableIdeas } from "./ai-provider";
import { buildEligiblePool } from "./pool";
import { TableIdeasError } from "./schemas";
import { fillBalancedSeatsAroundSeed, rankCandidates } from "./score";
import type { AiCandidateCard, TableCandidate, TableIdeaMode } from "./types";

export { TableIdeasError } from "./schemas";
export type { TableIdeasErrorCode } from "./schemas";

/** AI providers only ever see the top-ranked slice of the eligible pool. */
export const AI_CANDIDATE_CAP = 80;
const PRIMARY_SEATS = 15;
const ALTERNATE_SEATS = 5;

export type TableIdeaSeat = {
  id: string;
  fullName: string;
  email: string;
  company: string;
  sector: string;
  position: string;
  city: string;
};

export type ComposedTableIdea = {
  title: string;
  themeAngle: string;
  rationale: string;
  commonalities: string[];
  complementarities: string[];
  warnings: string[];
  primary: TableIdeaSeat[];
  alternates: TableIdeaSeat[];
};

type RawIdea = {
  title: string;
  themeAngle: string;
  rationale: string;
  commonalities: string[];
  complementarities: string[];
  warnings: string[];
  primaryMemberIds: string[];
  alternateMemberIds: string[];
};

function toSeat(candidate: TableCandidate): TableIdeaSeat {
  return {
    id: candidate.id,
    fullName: candidate.fullName,
    email: candidate.email,
    company: candidate.company,
    sector: candidate.sector,
    position: candidate.position,
    city: candidate.city,
  };
}

function mergeWarnings(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const group of groups) {
    for (const warning of group) {
      if (seen.has(warning)) continue;
      seen.add(warning);
      merged.push(warning);
    }
  }
  return merged;
}

function reconcileWithPool(
  idea: RawIdea,
  ranked: ReturnType<typeof rankCandidates>,
  candidatesById: Map<string, TableCandidate>,
): ComposedTableIdea {
  const balanced = fillBalancedSeatsAroundSeed(
    ranked,
    {
      primaryIds: idea.primaryMemberIds,
      alternateIds: idea.alternateMemberIds,
    },
    { primarySize: PRIMARY_SEATS, alternateSize: ALTERNATE_SEATS },
  );

  const fillWarnings: string[] = [];
  for (const id of balanced.primary.map((c) => c.id)) {
    if (!idea.primaryMemberIds.includes(id)) {
      fillWarnings.push(`filled missing primary seat deterministically: ${id}`);
    }
  }
  for (const id of balanced.alternates.map((c) => c.id)) {
    if (!idea.alternateMemberIds.includes(id)) {
      fillWarnings.push(`filled missing alternate seat deterministically: ${id}`);
    }
  }

  return {
    title: idea.title,
    themeAngle: idea.themeAngle,
    rationale: idea.rationale,
    commonalities: idea.commonalities,
    complementarities: idea.complementarities,
    warnings: mergeWarnings(idea.warnings, balanced.warnings, fillWarnings),
    primary: balanced.primary.map((c) => toSeat(candidatesById.get(c.id)!)),
    alternates: balanced.alternates.map((c) => toSeat(candidatesById.get(c.id)!)),
  };
}

export async function composeTableIdeas(input: {
  mode: TableIdeaMode;
  theme?: string;
  members: WaitlistRegistration[];
  participations: AdminEventParticipation[];
  events: AdminEvent[];
  city: string;
  excludeMemberIds?: string[];
  fetchImpl?: typeof fetch;
}): Promise<{ ideas: ComposedTableIdea[]; poolSize: number }> {
  const pool = buildEligiblePool({
    members: input.members,
    participations: input.participations,
    events: input.events,
    city: input.city,
    excludeMemberIds: input.excludeMemberIds,
  });

  if (pool.candidates.length === 0) {
    throw new TableIdeasError("pool_too_small");
  }

  const ranked = rankCandidates(pool.candidates);
  const candidatesById = new Map<string, TableCandidate>(ranked.map((c) => [c.id, c]));
  const aiCardsById = new Map(pool.aiCards.map((aiCard) => [aiCard.id, aiCard]));

  const cappedCards = ranked
    .slice(0, AI_CANDIDATE_CAP)
    .map((c) => aiCardsById.get(c.id))
    .filter((aiCard): aiCard is AiCandidateCard => Boolean(aiCard));

  const aiResult = await generateTableIdeas({
    mode: input.mode,
    theme: input.theme,
    candidates: cappedCards,
    fetchImpl: input.fetchImpl,
  });

  const ideas = aiResult.ideas.map((idea) => reconcileWithPool(idea, ranked, candidatesById));

  return { ideas, poolSize: pool.candidates.length };
}
