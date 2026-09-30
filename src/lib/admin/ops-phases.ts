/**
 * Product ops phases for the event command center (Jack · 9 étapes métier).
 * URL `?phase=` accepts these ids; legacy ids are normalized.
 */

export const OPS_PHASE_IDS = [
  "prep",
  "audience",
  "save_the_date",
  "qualify",
  "formal",
  "payment",
  "dinner_prep",
  "checkin",
  "feedback",
] as const;

export type OpsPhaseId = (typeof OPS_PHASE_IDS)[number];

export type OpsPhaseMeta = {
  id: OpsPhaseId;
  number: number;
  title: string;
  summary: string;
  /** Hide in RSVP (non-interest) mode when true. */
  interestOnly?: boolean;
};

/** Canonical 9-phase journey (interest / STD editions). */
export const INTEREST_OPS_PHASES: OpsPhaseMeta[] = [
  { id: "prep", number: 1, title: "Préparation", summary: "Identité, date, lieu, tarif, publish" },
  { id: "audience", number: 2, title: "Audience", summary: "Sélection des invités" },
  { id: "save_the_date", number: 3, title: "Save the Date", summary: "Template + envoi STD", interestOnly: true },
  { id: "qualify", number: 4, title: "Qualification", summary: "Réponses OUI/NON + relance", interestOnly: true },
  { id: "formal", number: 5, title: "Invitation formelle", summary: "Envoi aux OUI / invités" },
  { id: "payment", number: 6, title: "Confirmation & paiement", summary: "Relances ACCESS" },
  { id: "dinner_prep", number: 7, title: "Prépa dîner", summary: "Places dispo + tables" },
  { id: "checkin", number: 8, title: "Check-in", summary: "Présence le soir J" },
  { id: "feedback", number: 9, title: "Feedback", summary: "Satisfaction + apprentissages" },
];

/** RSVP editions skip STD / qualification panels. */
export const RSVP_OPS_PHASES: OpsPhaseMeta[] = INTEREST_OPS_PHASES.filter((p) => !p.interestOnly).map(
  (p, index) => ({ ...p, number: index + 1 }),
);

const LEGACY_PHASE_MAP: Record<string, OpsPhaseId> = {
  std: "prep",
  definitive: "prep",
  std_email: "save_the_date",
  std_relance: "qualify",
  formal: "formal",
  auto: "feedback",
  // already canonical
  prep: "prep",
  audience: "audience",
  save_the_date: "save_the_date",
  qualify: "qualify",
  payment: "payment",
  dinner_prep: "dinner_prep",
  checkin: "checkin",
  feedback: "feedback",
};

export function isOpsPhaseId(value: string | null | undefined): value is OpsPhaseId {
  return Boolean(value && (OPS_PHASE_IDS as readonly string[]).includes(value));
}

/** Normalize URL / legacy phase ids to a canonical OpsPhaseId. */
export function normalizeOpsPhaseId(
  raw: string | null | undefined,
  opts?: { interestMode?: boolean; fallback?: OpsPhaseId },
): OpsPhaseId {
  const fallback = opts?.fallback ?? "prep";
  if (!raw) return fallback;
  const mapped = LEGACY_PHASE_MAP[raw] ?? (isOpsPhaseId(raw) ? raw : fallback);
  if (opts?.interestMode === false) {
    const allowed = new Set(RSVP_OPS_PHASES.map((p) => p.id));
    if (!allowed.has(mapped)) {
      if (mapped === "save_the_date" || mapped === "qualify") return "audience";
      return fallback;
    }
  }
  return mapped;
}

export function opsPhasesForMode(interestMode: boolean): OpsPhaseMeta[] {
  return interestMode ? INTEREST_OPS_PHASES : RSVP_OPS_PHASES;
}
