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
] as const;

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
  source?: string | null;
  profileComplete?: boolean | null;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasActivities(value: string[] | null | undefined): boolean {
  return Boolean(value?.some((item) => hasText(item)));
}

/** 0–100 based on filled profile fields (equal weight). */
export function computeProfileCompletionPercent(profile: ProfileCompletionInput): number {
  let filled = 0;
  for (const field of PROFILE_COMPLETION_FIELDS) {
    if (field === "extraActivities") {
      if (hasActivities(profile.extraActivities)) filled += 1;
    } else if (hasText(profile[field])) {
      filled += 1;
    }
  }
  return Math.round((filled / PROFILE_COMPLETION_FIELDS.length) * 100);
}

export function isExpressSignup(profile: Pick<ProfileCompletionInput, "source" | "profileComplete">): boolean {
  if (profile.profileComplete === false) return true;
  const source = (profile.source ?? "").toLowerCase();
  return source.includes("express") || source.includes("light");
}
