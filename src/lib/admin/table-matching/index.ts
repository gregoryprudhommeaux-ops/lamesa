import type { AdminEvent, AdminEventParticipation, WaitlistRegistration } from "@/lib/types/events";
import { generateTableIdeas } from "./ai-provider";
import { buildEligiblePool } from "./pool";
import { TableIdeasError } from "./schemas";
import { fillBalancedSeatsAroundSeed, rankCandidates, selectBalancedTable } from "./score";
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

function topLabels(
  candidates: TableCandidate[],
  field: "sector" | "position" | "company",
  limit = 3,
): string[] {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    const value = candidate[field]?.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function buildDeterministicIdea(input: {
  mode: TableIdeaMode;
  theme?: string;
  city: string;
  ranked: ReturnType<typeof rankCandidates>;
}): RawIdea {
  const selected = selectBalancedTable(input.ranked, {
    primarySize: PRIMARY_SEATS,
    alternateSize: ALTERNATE_SEATS,
  });
  const sectors = topLabels(selected.primary, "sector");
  const positions = topLabels(selected.primary, "position");
  const theme =
    input.mode === "admin_theme" && input.theme?.trim()
      ? input.theme.trim()
      : sectors.length > 0
        ? `Table ${sectors.slice(0, 2).join(" × ")} — ${input.city}`
        : `Table ${input.city}`;

  return {
    title: theme.slice(0, 120),
    themeAngle:
      input.mode === "admin_theme" && input.theme?.trim()
        ? `Composition autour du thème « ${input.theme.trim()} ».`
        : `Composition déterministe pour ${input.city}.`,
    rationale:
      "Table assemblée à partir du scoring interne (priorité aux non-invités récents, diversité secteur/entreprise, complétion de profil). Active une clé OpenAI/AI Gateway pour des thèmes et explications plus riches.",
    commonalities: [
      ...(sectors.length ? [`Secteurs représentés : ${sectors.join(", ")}`] : []),
      ...(positions.length ? [`Postes : ${positions.join(", ")}`] : []),
      `Ville : ${input.city}`,
    ],
    complementarities: [
      "Mix de profils pour éviter une table mono-secteur",
      "Priorité aux membres non invités à la table précédente",
    ],
    warnings: [
      "Composition déterministe — IA non configurée.",
      ...selected.warnings,
    ],
    primaryMemberIds: selected.primary.map((c) => c.id),
    alternateMemberIds: selected.alternates.map((c) => c.id),
  };
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

  let rawIdeas: RawIdea[];
  try {
    const aiResult = await generateTableIdeas({
      mode: input.mode,
      theme: input.theme,
      candidates: cappedCards,
      fetchImpl: input.fetchImpl,
    });
    rawIdeas = aiResult.ideas;
  } catch (error) {
    if (!(error instanceof TableIdeasError) || error.code !== "ai_not_configured") {
      throw error;
    }
    rawIdeas = [
      buildDeterministicIdea({
        mode: input.mode,
        theme: input.theme,
        city: input.city,
        ranked,
      }),
    ];
  }

  const ideas = rawIdeas.map((idea) => reconcileWithPool(idea, ranked, candidatesById));

  return { ideas, poolSize: pool.candidates.length };
}
