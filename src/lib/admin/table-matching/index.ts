import type { AdminEvent, AdminEventParticipation, WaitlistRegistration } from "@/lib/types/events";
import { generateTableIdeas } from "./ai-provider";
import { buildEligiblePool } from "./pool";
import { TableIdeasError } from "./schemas";
import {
  fillBalancedSeatsAroundSeed,
  isThemePrimaryQualified,
  rankCandidates,
  selectBalancedTable,
  type RankedCandidate,
  type ThemeFitBand,
} from "./score";
import type { AiCandidateCard, TableCandidate, TableIdeaMode } from "./types";

export { TableIdeasError } from "./schemas";
export type { TableIdeasErrorCode } from "./schemas";
export type { ThemeFitBand } from "./score";

/** AI providers only ever see the top-ranked slice of the eligible pool. */
export const AI_CANDIDATE_CAP = 80;
export const PRIMARY_SEATS = 15;
export const ALTERNATE_SEATS = 5;

export type TableIdeaSeat = {
  id: string;
  fullName: string;
  email: string;
  company: string;
  sector: string;
  position: string;
  city: string;
  /** Past formal invites across dinners (deprioritized in scoring). */
  invitationCount: number;
  /** Invited on the immediately previous event — strongest deprioritization. */
  invitedToPreviousEvent: boolean;
  /** Lexical theme fit when composing in admin_theme mode. */
  themeFitBand?: ThemeFitBand;
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

function toSeat(candidate: TableCandidate, themeFitBand?: ThemeFitBand): TableIdeaSeat {
  return {
    id: candidate.id,
    fullName: candidate.fullName,
    email: candidate.email,
    company: candidate.company,
    sector: candidate.sector,
    position: candidate.position,
    city: candidate.city,
    invitationCount: candidate.invitationCount,
    invitedToPreviousEvent: candidate.invitedToPreviousEvent,
    ...(themeFitBand ? { themeFitBand } : {}),
  };
}

function humanizeInternalWarning(warning: string): string {
  const themeShort = /^theme_pool_short:(\d+):(\d+):(\d+)$/.exec(warning);
  if (themeShort) {
    const seated = Number(themeShort[1]);
    const target = Number(themeShort[2]);
    const qualified = Number(themeShort[3]);
    return `${qualified} profil(s) qualifié(s) fort/moyen pour ${target} places (${seated} assis) — recrute des inscrits alignés ou change de thème. Pas de remplissage hors-sujet.`;
  }
  return warning;
}

function mergeWarnings(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const group of groups) {
    for (const warning of group) {
      const human = humanizeInternalWarning(warning);
      if (seen.has(human)) continue;
      seen.add(human);
      merged.push(human);
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
  ranked: RankedCandidate[];
  aiFallbackReason?: "not_configured" | "provider_failed";
}): RawIdea {
  const adminTheme = input.mode === "admin_theme" ? input.theme?.trim() : undefined;
  const themeStrict = Boolean(adminTheme);
  const selected = selectBalancedTable(input.ranked, {
    primarySize: PRIMARY_SEATS,
    alternateSize: ALTERNATE_SEATS,
    themeStrict,
  });
  const sectors = topLabels(selected.primary, "sector");
  const positions = topLabels(selected.primary, "position");
  const themeTitle =
    adminTheme && adminTheme.length > 0
      ? adminTheme
      : sectors.length > 0
        ? `Table ${sectors.slice(0, 2).join(" × ")} — ${input.city}`
        : `Table ${input.city}`;

  const themeFitCounts = {
    strong: selected.primary.filter((c) => c.themeFitBand === "strong").length,
    medium: selected.primary.filter((c) => c.themeFitBand === "medium").length,
    weak: selected.primary.filter((c) => c.themeFitBand === "weak").length,
    none: selected.primary.filter((c) => !c.themeFitBand || c.themeFitBand === "none").length,
  };
  const qualifiedInPool = input.ranked.filter((c) =>
    isThemePrimaryQualified(c.themeFitBand),
  ).length;

  const aiWarning =
    input.aiFallbackReason === "provider_failed"
      ? "Composition déterministe — l’IA n’a pas répondu (scoring thème + historique utilisé)."
      : "Composition déterministe — IA non configurée (scoring thème + historique).";

  const themeWarnings: string[] = [];
  if (adminTheme) {
    if (qualifiedInPool === 0) {
      themeWarnings.push(
        "Aucun profil fort/moyen sur ce thème — recrute des inscrits alignés ou change de thématique. Besoin marché non couvert par le pool actuel.",
      );
    }
  }

  return {
    title: themeTitle.slice(0, 120),
    themeAngle: adminTheme
      ? `Composition autour du thème « ${adminTheme} » — uniquement profils fort/moyen (pas de remplissage).`
      : `Composition déterministe pour ${input.city}.`,
    rationale: adminTheme
      ? `Table qualité : sièges réservés aux profils alignés fort/moyen sur « ${adminTheme} » (dinnerThemesInterest, secteur, poste, notes ops). Un effectif court = recruter ou revoir le thème.`
      : "Table assemblée à partir du scoring interne (priorité aux non-invités récents, diversité secteur/entreprise, complétion de profil).",
    commonalities: [
      ...(adminTheme
        ? [
            `Alignement thème : ${themeFitCounts.strong} fort / ${themeFitCounts.medium} moyen (qualifiés ${selected.primary.length}/${PRIMARY_SEATS})`,
          ]
        : []),
      ...(sectors.length ? [`Secteurs représentés : ${sectors.join(", ")}`] : []),
      ...(positions.length ? [`Postes : ${positions.join(", ")}`] : []),
      `Ville : ${input.city}`,
    ],
    complementarities: [
      adminTheme
        ? "Qualité d’abord : pas de titulaires hors-thème pour remplir la table"
        : "Mix de profils pour éviter une table mono-secteur",
      "Priorité aux membres non invités à la table précédente",
    ],
    warnings: mergeWarnings([aiWarning, ...themeWarnings], selected.warnings),
    primaryMemberIds: selected.primary.map((c) => c.id),
    alternateMemberIds: selected.alternates.map((c) => c.id),
  };
}

function reconcileWithPool(
  idea: RawIdea,
  ranked: RankedCandidate[],
  candidatesById: Map<string, TableCandidate>,
  themeStrict: boolean,
): ComposedTableIdea {
  const balanced = fillBalancedSeatsAroundSeed(
    ranked,
    {
      primaryIds: idea.primaryMemberIds,
      alternateIds: idea.alternateMemberIds,
    },
    { primarySize: PRIMARY_SEATS, alternateSize: ALTERNATE_SEATS, themeStrict },
  );

  const bandById = new Map(ranked.map((c) => [c.id, c.themeFitBand]));

  const fillWarnings: string[] = [];
  if (!themeStrict) {
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
  }

  return {
    title: idea.title,
    themeAngle: idea.themeAngle,
    rationale: idea.rationale,
    commonalities: idea.commonalities,
    complementarities: idea.complementarities,
    warnings: mergeWarnings(idea.warnings, balanced.warnings, fillWarnings),
    primary: balanced.primary.map((c) =>
      toSeat(candidatesById.get(c.id)!, bandById.get(c.id)),
    ),
    alternates: balanced.alternates.map((c) =>
      toSeat(candidatesById.get(c.id)!, bandById.get(c.id)),
    ),
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

  const themeForRanking =
    input.mode === "admin_theme" && input.theme?.trim() ? input.theme.trim() : undefined;
  const ranked = rankCandidates(pool.candidates, { theme: themeForRanking });
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
    const aiError = error instanceof TableIdeasError ? error : null;
    const canFallback =
      aiError &&
      (aiError.code === "ai_not_configured" ||
        aiError.code === "fetch_failed" ||
        aiError.code === "ai_invalid");

    if (!canFallback) {
      throw error;
    }

    if (aiError.code !== "ai_not_configured") {
      console.error("[table-matching] AI fallback:", aiError.code, aiError.message);
    }

    rawIdeas = [
      buildDeterministicIdea({
        mode: input.mode,
        theme: input.theme,
        city: input.city,
        ranked,
        aiFallbackReason:
          aiError.code === "ai_not_configured" ? "not_configured" : "provider_failed",
      }),
    ];
  }

  const ideas = rawIdeas.map((idea) =>
    reconcileWithPool(idea, ranked, candidatesById, Boolean(themeForRanking)),
  );

  return { ideas, poolSize: pool.candidates.length };
}
