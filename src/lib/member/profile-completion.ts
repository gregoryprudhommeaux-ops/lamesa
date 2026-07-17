/** Fields that count toward admin-facing profile completion %. */
export const PROFILE_COMPLETION_FIELDS = [
  "fullName",
  "email",
  "phone",
  "company",
  "sector",
  "position",
  "city",
  "linkedinUrl",
  "invitationMotivation",
  "extraActivities",
  "canBring",
  "isSeeking",
] as const;

export type ProfileCompletionField = (typeof PROFILE_COMPLETION_FIELDS)[number];

/** French labels for admin tooltips (missing fields). */
export const PROFILE_COMPLETION_FIELD_LABELS_FR: Record<ProfileCompletionField, string> = {
  fullName: "nom",
  email: "email",
  phone: "téléphone",
  company: "entreprise",
  sector: "secteur",
  position: "poste",
  city: "ville",
  linkedinUrl: "LinkedIn",
  invitationMotivation: "motivation",
  extraActivities: "activités",
  canBring: "ce qu’il peut apporter",
  isSeeking: "ce qu’il recherche",
};

export type ProfileCompletionInput = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  sector?: string | null;
  position?: string | null;
  city?: string | null;
  linkedinUrl?: string | null;
  invitationMotivation?: string | null;
  extraActivities?: string[] | null;
  canBring?: string | null;
  isSeeking?: string | null;
  source?: string | null;
  profileComplete?: boolean | null;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasActivities(value: string[] | null | undefined): boolean {
  return Boolean(value?.some((item) => hasText(item)));
}

function isFieldFilled(
  profile: ProfileCompletionInput,
  field: ProfileCompletionField,
): boolean {
  if (field === "extraActivities") return hasActivities(profile.extraActivities);
  return hasText(profile[field]);
}

/** 0–100 based on filled profile fields (equal weight). */
export function computeProfileCompletionPercent(profile: ProfileCompletionInput): number {
  let filled = 0;
  for (const field of PROFILE_COMPLETION_FIELDS) {
    if (isFieldFilled(profile, field)) filled += 1;
  }
  return Math.round((filled / PROFILE_COMPLETION_FIELDS.length) * 100);
}

/** French labels of empty fields that keep completion under 100%. */
export function listMissingProfileFieldsFr(profile: ProfileCompletionInput): string[] {
  return PROFILE_COMPLETION_FIELDS.filter((field) => !isFieldFilled(profile, field)).map(
    (field) => PROFILE_COMPLETION_FIELD_LABELS_FR[field],
  );
}

export function isExpressSignup(profile: Pick<ProfileCompletionInput, "source" | "profileComplete">): boolean {
  if (profile.profileComplete === false) return true;
  const source = (profile.source ?? "").toLowerCase();
  return source.includes("express") || source.includes("light");
}
