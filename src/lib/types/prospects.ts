export const PROSPECT_STATUSES = [
  "to_contact",
  "to_follow",
  "contacted",
  "no_response",
  "no_not_interested",
  "no_not_available",
  "won",
  "do_not_contact",
] as const;

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

/** French labels for admin CRM dropdowns. */
export const PROSPECT_STATUS_LABELS_FR: Record<ProspectStatus, string> = {
  to_contact: "À contacter",
  to_follow: "À suivre",
  contacted: "Contacté",
  no_response: "Sans réponse",
  no_not_interested: "NON (pas intéressés)",
  no_not_available: "NON (pas disponible)",
  won: "Gagné / inscrit",
  do_not_contact: "Ne pas contacter",
};

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
  /** Template campaigns successfully sent; prevents selecting the same contact twice. */
  sentTemplateKeys?: string[];
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
