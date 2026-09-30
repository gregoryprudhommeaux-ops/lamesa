export const CONTACT_ACTIVITY_TYPES = [
  "added_prospect",
  "registered_platform",
  "email_sent",
  "list_added",
  "status_changed",
  "invited_event",
  "rsvp_yes",
  "rsvp_no",
  "confirmed_seat",
  "payment_declared",
  "seen_marked",
  "interest_yes",
  "interest_no",
  "survey_submitted",
] as const;

export type ContactActivityType = (typeof CONTACT_ACTIVITY_TYPES)[number];

export type ContactActivitySource = "system" | "admin" | "guest";

export type ContactActivityRefs = {
  eventId?: string;
  participationId?: string;
  prospectId?: string;
  waitlistId?: string;
  templateKey?: string;
  listName?: string;
};

export type ContactActivity = {
  id: string;
  email: string;
  type: ContactActivityType;
  at: string;
  source: ContactActivitySource;
  summary: string;
  refs?: ContactActivityRefs;
  meta?: Record<string, string | number | boolean | null>;
  createdAt: string;
  /** True when synthesized from existing docs (not stored). */
  derived?: boolean;
};

export type ContactActivityInput = {
  email: string;
  type: ContactActivityType;
  at?: string;
  source?: ContactActivitySource;
  summary: string;
  refs?: ContactActivityRefs;
  meta?: Record<string, string | number | boolean | null>;
};

export type ContactSurveySnapshot = {
  venueQuality: number;
  menuQuality: number;
  guestsQuality: number;
  wouldReturn: number;
  wouldRecommend: number | null;
  /** 0–5 when present on newer surveys. */
  valueForMoney?: number | null;
  comment?: string;
  submittedAt: string;
  /** Mean of available 0–5 scores. */
  overall: number;
};

export type ContactEventRow = {
  eventId: string;
  title: string;
  startsAt: string | null;
  status: string;
  participationId: string | null;
  /** MXN TTC attributed when seat is confirmed; else 0. */
  revenueMxn: number;
  rsvpAt: string | null;
  inviteSentAt: string | null;
  /** STD / interest form answer when present. */
  interestResponse: string | null;
  survey: ContactSurveySnapshot | null;
};

export type ContactStats = {
  addedAt: string | null;
  registeredAt: string | null;
  invitationsCount: number;
  confirmedCount: number;
  declinedCount: number;
  revenueMxn: number;
  surveyCount: number;
  avgOverall: number | null;
  avgWouldRecommend: number | null;
  lastOutreachAt: string | null;
  events: ContactEventRow[];
};
