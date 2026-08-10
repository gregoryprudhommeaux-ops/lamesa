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
  tags: string[];
  status: ProspectStatus;
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
  status?: ProspectStatus;
  source?: string;
};

export type ProspectImportRow = ProspectInput;
