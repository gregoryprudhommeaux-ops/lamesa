import { SECTOR_LABELS_FR } from "@/lib/admin/waitlist-labels-fr";
import type { TableCandidate } from "./types";

/** Theme-fit bonuses layered on top of invite/completion scoring. */
export const THEME_SCORE = {
  strong: 48,
  medium: 28,
  weak: 12,
  nonePenalty: -8,
} as const;

/**
 * Synonym groups: any token in a group expands matching to sibling tokens
 * and to sector / position codes used on waitlist profiles.
 */
const THEME_SYNONYM_GROUPS: string[][] = [
  [
    "finance",
    "investissement",
    "investment",
    "investments",
    "investir",
    "investor",
    "investors",
    "investisseur",
    "investisseurs",
    "family office",
    "family offices",
    "familyoffice",
    "fo",
    "private equity",
    "privateequity",
    "pe",
    "venture",
    "venture capital",
    "vc",
    "capital risque",
    "capital-risque",
    "investment banking",
    "investmentbanking",
    "banque",
    "banking",
    "levée de fonds",
    "levee de fonds",
    "fundraising",
    "fundraise",
    "fund raising",
    "fonds",
    "fund",
    "lp",
    "gp",
    "dealflow",
    "deal flow",
    "m&a",
    "ma",
    "fintech",
  ],
  ["tech", "digital", "saas", "software", "startup", "startups", "ia", "ai"],
  ["consulting", "conseil", "consultant", "advisory"],
  ["real estate", "immobilier", "real_estate", "proptech"],
  ["legal", "juridique", "avocat", "law"],
  ["health", "santé", "sante", "healthcare", "healthtech"],
  ["marketing", "communication", "brand"],
  ["energy", "énergie", "energie", "climate", "climat"],
];

const SECTOR_CODE_ALIASES: Record<string, string[]> = {
  finance: ["finance", "investissement", "investment", "investor", "fintech", "banking"],
  tech: ["tech", "digital", "saas", "software", "startup", "ai", "ia"],
  consulting: ["consulting", "conseil", "advisory"],
  real_estate: ["real estate", "immobilier", "real_estate", "proptech"],
  legal: ["legal", "juridique", "law"],
  health: ["health", "santé", "sante", "healthcare"],
  marketing: ["marketing", "communication"],
  energy: ["energy", "énergie", "energie", "climate"],
};

const POSITION_CODE_ALIASES: Record<string, string[]> = {
  investor: ["investor", "investisseur", "investisseurs", "lp", "gp", "vc", "pe"],
  founder: ["founder", "fondateur", "cofounder", "co-founder"],
  ceo: ["ceo", "dg", "directeur general", "directeur général"],
  director: ["director", "directeur"],
  consultant: ["consultant", "consulting", "conseil"],
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9&\s+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Multi-word phrases first so "private equity" stays one token. */
const PHRASE_PATTERNS = [
  "family office",
  "family offices",
  "private equity",
  "venture capital",
  "investment banking",
  "levee de fonds",
  "levée de fonds",
  "fund raising",
  "deal flow",
  "real estate",
  "capital risque",
  "capital-risque",
];

export function tokenizeTheme(theme: string): string[] {
  const normalized = normalize(theme);
  if (!normalized) return [];

  const tokens = new Set<string>();
  let remaining = ` ${normalized} `;

  for (const phrase of PHRASE_PATTERNS) {
    const needle = ` ${normalize(phrase)} `;
    if (remaining.includes(needle)) {
      tokens.add(normalize(phrase));
      remaining = remaining.split(needle).join(" ");
    }
  }

  for (const part of remaining.split(/[\s,/|;·•]+/)) {
    const token = part.trim();
    if (token.length >= 2) tokens.add(token);
  }

  return [...tokens];
}

function expandTokens(tokens: string[]): Set<string> {
  const expanded = new Set(tokens.map(normalize).filter(Boolean));
  for (const token of [...expanded]) {
    for (const group of THEME_SYNONYM_GROUPS) {
      const normalizedGroup = group.map(normalize);
      if (normalizedGroup.includes(token)) {
        for (const sibling of normalizedGroup) expanded.add(sibling);
      }
    }
  }
  return expanded;
}

function fieldBlob(candidate: TableCandidate): string {
  const sectorLabel = SECTOR_LABELS_FR[candidate.sector] ?? candidate.sector;
  return normalize(
    [
      candidate.dinnerThemesInterest,
      candidate.sector,
      sectorLabel,
      candidate.position,
      candidate.company,
      candidate.canBring,
      candidate.isSeeking,
      candidate.invitationMotivation,
      candidate.opsNotes,
      ...candidate.extraActivities,
    ].join(" "),
  );
}

function countTokenHits(haystack: string, tokens: Set<string>): { hits: string[]; weight: number } {
  const hits: string[] = [];
  let weight = 0;
  for (const token of tokens) {
    if (token.length < 2) continue;
    // Word-boundary-ish: spaces around, or start/end.
    const padded = ` ${haystack} `;
    if (padded.includes(` ${token} `) || haystack.includes(token)) {
      // Prefer whole-token hits for short codes (vc, pe, fo).
      if (token.length <= 3 && !padded.includes(` ${token} `)) continue;
      hits.push(token);
      weight += token.length >= 8 ? 3 : token.length >= 4 ? 2 : 1;
    }
  }
  return { hits, weight };
}

export type ThemeFitResult = {
  score: number;
  band: "strong" | "medium" | "weak" | "none";
  matchedTokens: string[];
  reasons: string[];
};

/**
 * Score how well a candidate fits an admin theme.
 * Pure lexical + synonym expansion — no network / AI.
 */
export function scoreThemeFit(candidate: TableCandidate, theme: string): ThemeFitResult {
  const themeTokens = tokenizeTheme(theme);
  if (themeTokens.length === 0) {
    return { score: 0, band: "none", matchedTokens: [], reasons: [] };
  }

  const expanded = expandTokens(themeTokens);
  const reasons: string[] = [];
  let raw = 0;

  const dinner = normalize(candidate.dinnerThemesInterest);
  if (dinner) {
    const { hits, weight } = countTokenHits(dinner, expanded);
    if (weight > 0) {
      raw += Math.min(36, weight * 6);
      reasons.push(`dinnerThemesInterest match (${hits.slice(0, 4).join(", ")})`);
    }
  }

  const sectorAliases = SECTOR_CODE_ALIASES[candidate.sector] ?? [];
  const sectorExpanded = expandTokens(sectorAliases);
  const sectorOverlap = [...sectorExpanded].filter((token) => expanded.has(token));
  if (sectorOverlap.length > 0) {
    raw += 30;
    reasons.push(`sector ${candidate.sector} aligns with theme`);
  }

  const positionAliases = POSITION_CODE_ALIASES[candidate.position] ?? [];
  const positionExpanded = expandTokens(positionAliases);
  const positionOverlap = [...positionExpanded].filter((token) => expanded.has(token));
  if (positionOverlap.length > 0) {
    raw += 18;
    reasons.push(`position ${candidate.position} aligns with theme`);
  }

  const blob = fieldBlob(candidate);
  const { hits: blobHits, weight: blobWeight } = countTokenHits(blob, expanded);
  if (blobWeight > 0) {
    raw += Math.min(24, blobWeight * 3);
    if (!reasons.some((r) => r.includes("dinnerThemesInterest"))) {
      reasons.push(`profile text match (${blobHits.slice(0, 4).join(", ")})`);
    }
  }

  let band: ThemeFitResult["band"] = "none";
  let score = THEME_SCORE.nonePenalty;
  if (raw >= 40) {
    band = "strong";
    score = THEME_SCORE.strong;
  } else if (raw >= 22) {
    band = "medium";
    score = THEME_SCORE.medium;
  } else if (raw >= 8) {
    band = "weak";
    score = THEME_SCORE.weak;
  } else {
    reasons.push("no theme signal");
  }

  return {
    score,
    band,
    matchedTokens: [...new Set(blobHits)].slice(0, 8),
    reasons,
  };
}
