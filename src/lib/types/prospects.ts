export const PROSPECT_STATUSES = [
  "to_contact",
  "contacted",
  "nurture",
  "won",
  "do_not_contact",
] as const;

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

/** Internal outreach CRM contact (admin only). Email required. */
export type Prospect = {
  id: string;
  email: string;
  fullName: string;
  company: string;
  position: string;
  sector: string;
  city: string;
  linkedin: string;
  phone: string;
  notes: string;
  /** Free tags (relances, segments…). */
  tags: string[];
  /** Named playlists (sélection → ajouter à une liste). */
  lists: string[];
  status: ProspectStatus;
  /** Vu! */
  seen: boolean;
  source: string;
  createdAt: string;
  updatedAt: string;
  lastContactedAt?: string | null;
  deletedAt?: string | null;
};

export type ProspectInput = {
  email: string;
  fullName?: string;
  company?: string;
  position?: string;
  sector?: string;
  city?: string;
  linkedin?: string;
  phone?: string;
  notes?: string;
  tags?: string[];
  lists?: string[];
  status?: ProspectStatus;
  seen?: boolean;
  source?: string;
};

export type ProspectImportRow = ProspectInput;
