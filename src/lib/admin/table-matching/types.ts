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
