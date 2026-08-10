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
  "seen_marked",
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

export type ContactEventRow = {
  eventId: string;
  title: string;
  startsAt: string | null;
  status: string;
  participationId: string;
};

export type ContactStats = {
  addedAt: string | null;
  registeredAt: string | null;
  invitationsCount: number;
  confirmedCount: number;
  declinedCount: number;
  revenueMxn: number;
  lastOutreachAt: string | null;
  events: ContactEventRow[];
};
