import type { TableCandidate } from "./types";

export const TABLE_SCORE = {
  notPreviousEvent: 30,
  neverInvited: 15,
  completionHigh: 10,
  completionLow: -10,
  recentCoPresence: -6,
  duplicateCompany: -40,
  sectorOverFour: -12,
} as const;

export type RankedCandidate = TableCandidate & {
  baseScore: number;
  reasons: string[];
};

const DEFAULT_PRIMARY_SIZE = 15;
const DEFAULT_ALTERNATE_SIZE = 5;

const normalizeText = (value: string) => value.trim().toLocaleLowerCase("es-MX");

const normalizeCompany = (company: string) => normalizeText(company);

const normalizeSector = (sector: string) => normalizeText(sector);

/** Host-locale-independent id ordering (UTF-16 code units). */
function compareIds(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function dedupeByIdFirstWins<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

function sanitizeSeatCount(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function scoreCandidate(candidate: TableCandidate): RankedCandidate {
  let baseScore = 0;
  const reasons: string[] = [];

  if (!candidate.invitedToPreviousEvent) {
    baseScore += TABLE_SCORE.notPreviousEvent;
    reasons.push("not invited to previous event");
  } else {
    reasons.push("invited to previous event");
  }

  if (candidate.invitationCount === 0) {
    baseScore += TABLE_SCORE.neverInvited;
    reasons.push("never invited");
  }

  if (candidate.completionBand === "high") {
    baseScore += TABLE_SCORE.completionHigh;
    reasons.push("high profile completion");
  } else if (candidate.completionBand === "low") {
    baseScore += TABLE_SCORE.completionLow;
    reasons.push("low profile completion");
  }

  if (candidate.coPresentMemberIds.length > 0) {
    baseScore += TABLE_SCORE.recentCoPresence;
    reasons.push("recent co-presence");
  }

  return { ...candidate, baseScore, reasons };
}

function compareRanked(a: RankedCandidate, b: RankedCandidate): number {
  return b.baseScore - a.baseScore || compareIds(a.id, b.id);
}

function effectivePrimaryScore(
  candidate: RankedCandidate,
  primary: RankedCandidate[],
): number {
  let score = candidate.baseScore;

  const normalizedCompany = normalizeCompany(candidate.company);
  if (
    normalizedCompany &&
    primary.some((member) => normalizeCompany(member.company) === normalizedCompany)
  ) {
    score += TABLE_SCORE.duplicateCompany;
  }

  const normalizedSector = normalizeSector(candidate.sector);
  if (normalizedSector) {
    const sectorCount = primary.filter(
      (member) => normalizeSector(member.sector) === normalizedSector,
    ).length;
    if (sectorCount >= 4) {
      score += TABLE_SCORE.sectorOverFour;
    }
  }

  return score;
}

function pickNextPrimary(
  remaining: RankedCandidate[],
  primary: RankedCandidate[],
): RankedCandidate {
  return [...remaining].sort((a, b) => {
    const scoreDelta =
      effectivePrimaryScore(b, primary) - effectivePrimaryScore(a, primary);
    return scoreDelta || compareIds(a.id, b.id);
  })[0];
}

function buildReferralWarnings(primary: RankedCandidate[]): string[] {
  const primaryIds = new Set(primary.map(({ id }) => id));
  const warnings: string[] = [];

  for (const member of primary) {
    if (member.referredById && primaryIds.has(member.referredById)) {
      warnings.push(
        `referral pair seated together: ${member.referredById} and ${member.id}`,
      );
    }
  }

  return warnings;
}

function resolveSeedSeats(
  rankedById: Map<string, RankedCandidate>,
  seedIds: string[],
): RankedCandidate[] {
  const seats: RankedCandidate[] = [];
  for (const id of seedIds) {
    const candidate = rankedById.get(id);
    if (candidate) seats.push(candidate);
  }
  return seats;
}

export function rankCandidates(candidates: TableCandidate[]): RankedCandidate[] {
  return dedupeByIdFirstWins(candidates).map(scoreCandidate).sort(compareRanked);
}

export function selectBalancedTable(
  ranked: RankedCandidate[],
  options?: { primarySize?: number; alternateSize?: number },
): {
  primary: RankedCandidate[];
  alternates: RankedCandidate[];
  warnings: string[];
} {
  const primarySize = sanitizeSeatCount(options?.primarySize, DEFAULT_PRIMARY_SIZE);
  const alternateSize = sanitizeSeatCount(options?.alternateSize, DEFAULT_ALTERNATE_SIZE);
  const warnings: string[] = [];

  const uniqueRanked = dedupeByIdFirstWins(ranked);
  const remaining = [...uniqueRanked].sort(compareRanked);
  const primary: RankedCandidate[] = [];

  while (primary.length < primarySize && remaining.length > 0) {
    const next = pickNextPrimary(remaining, primary);
    primary.push(next);
    const index = remaining.findIndex(({ id }) => id === next.id);
    remaining.splice(index, 1);
  }

  const alternates = remaining
    .sort(compareRanked)
    .slice(0, alternateSize);

  if (uniqueRanked.length < primarySize + alternateSize) {
    warnings.push(
      `pool too small: ${uniqueRanked.length} eligible members for ${primarySize + alternateSize} seats`,
    );
  }

  warnings.push(...buildReferralWarnings(primary));

  return { primary, alternates, warnings };
}

/**
 * Completes a table around AI-selected seed seats, re-evaluating company/sector
 * soft penalties against the growing primary list (AI picks + fillers).
 */
export function fillBalancedSeatsAroundSeed(
  ranked: RankedCandidate[],
  seed: { primaryIds: string[]; alternateIds: string[] },
  options?: { primarySize?: number; alternateSize?: number },
): {
  primary: RankedCandidate[];
  alternates: RankedCandidate[];
  warnings: string[];
} {
  const primarySize = sanitizeSeatCount(options?.primarySize, DEFAULT_PRIMARY_SIZE);
  const alternateSize = sanitizeSeatCount(options?.alternateSize, DEFAULT_ALTERNATE_SIZE);
  const warnings: string[] = [];

  const uniqueRanked = dedupeByIdFirstWins(ranked);
  const rankedById = new Map(uniqueRanked.map((c) => [c.id, c]));
  const usedIds = new Set<string>();

  const primary = resolveSeedSeats(rankedById, seed.primaryIds).slice(0, primarySize);
  for (const member of primary) usedIds.add(member.id);

  const remaining = uniqueRanked
    .filter((c) => !usedIds.has(c.id))
    .sort(compareRanked);

  while (primary.length < primarySize && remaining.length > 0) {
    const next = pickNextPrimary(remaining, primary);
    primary.push(next);
    usedIds.add(next.id);
    const index = remaining.findIndex(({ id }) => id === next.id);
    remaining.splice(index, 1);
  }

  const alternateSeeds = resolveSeedSeats(rankedById, seed.alternateIds).filter(
    (c) => !usedIds.has(c.id),
  );
  const alternates: RankedCandidate[] = [];
  for (const seedAlt of alternateSeeds) {
    if (alternates.length >= alternateSize) break;
    alternates.push(seedAlt);
    usedIds.add(seedAlt.id);
  }

  const remainingForAlts = uniqueRanked
    .filter((c) => !usedIds.has(c.id))
    .sort(compareRanked);
  for (const candidate of remainingForAlts) {
    if (alternates.length >= alternateSize) break;
    alternates.push(candidate);
    usedIds.add(candidate.id);
  }

  if (uniqueRanked.length < primarySize + alternateSize) {
    warnings.push(
      `pool too small: ${uniqueRanked.length} eligible members for ${primarySize + alternateSize} seats`,
    );
  }

  warnings.push(...buildReferralWarnings(primary));

  return { primary, alternates, warnings };
}
