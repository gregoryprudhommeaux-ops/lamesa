export type TableIdeaMode = "spontaneous" | "admin_theme";
export type CompletionBand = "high" | "mid" | "low";

export type TableCandidate = {
  id: string;
  fullName: string;
  email: string;
  company: string;
  sector: string;
  position: string;
  city: string;
  invitationMotivation: string;
  extraActivities: string[];
  canBring: string;
  isSeeking: string;
  /** Declared dinner themes (industry / experience / problem space). */
  dinnerThemesInterest: string;
<<<<<<< HEAD
  /** Admin ops / table-curation notes — weighed by AI scan. */
=======
  /** Admin ops / table-curation notes — weighed by theme fit + AI scan. */
>>>>>>> 858ebe5 (feat(admin): theme-aware table scan + stronger AI fallback)
  opsNotes: string;
  completionPercent: number;
  completionBand: CompletionBand;
  invitationCount: number;
  invitedToPreviousEvent: boolean;
  coPresentMemberIds: string[];
  referredById?: string;
};

export type AiCandidateCard = Omit<
  TableCandidate,
  "fullName" | "email" | "coPresentMemberIds" | "referredById"
>;
