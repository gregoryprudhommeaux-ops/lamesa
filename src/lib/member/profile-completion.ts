import { isOtherSector } from "@/lib/constants/form-options";

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
  sector: "secteur (préciser si Autre)",
  position: "poste",
  city: "ville",
  linkedinUrl: "LinkedIn",
  invitationMotivation: "motivation",
  extraActivities: "activités",
  canBring: "ce qu’il peut apporter",
  isSeeking: "ce qu’il recherche",
};

/** Spanish labels for member-facing emails. */
export const PROFILE_COMPLETION_FIELD_LABELS_ES: Record<ProfileCompletionField, string> = {
  fullName: "nombre",
  email: "correo",
  phone: "teléfono",
  company: "empresa",
  sector: "sector (precisa si elegiste Otro)",
  position: "puesto",
  city: "ciudad",
  linkedinUrl: "LinkedIn",
  invitationMotivation: "motivación",
  extraActivities: "actividades",
  canBring: "qué puedes aportar",
  isSeeking: "qué buscas",
};

/** English labels for member-facing UI. */
export const PROFILE_COMPLETION_FIELD_LABELS_EN: Record<ProfileCompletionField, string> = {
  fullName: "full name",
  email: "email",
  phone: "phone",
  company: "company",
  sector: "industry (specify if Other)",
  position: "role",
  city: "city",
  linkedinUrl: "LinkedIn",
  invitationMotivation: "motivation",
  extraActivities: "interests",
  canBring: "what you can bring",
  isSeeking: "what you’re looking for",
};

export type ProfileCompletionInput = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  sector?: string | null;
  sectorOther?: string | null;
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

function isSectorFilled(profile: ProfileCompletionInput): boolean {
  if (!hasText(profile.sector)) return false;
  if (isOtherSector(profile.sector)) return hasText(profile.sectorOther);
  return true;
}

function isFieldFilled(
  profile: ProfileCompletionInput,
  field: ProfileCompletionField,
): boolean {
  if (field === "extraActivities") return hasActivities(profile.extraActivities);
  if (field === "sector") return isSectorFilled(profile);
  return hasText(profile[field] as string | null | undefined);
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

/** Spanish labels of empty fields (member emails). */
export function listMissingProfileFieldsEs(profile: ProfileCompletionInput): string[] {
  return PROFILE_COMPLETION_FIELDS.filter((field) => !isFieldFilled(profile, field)).map(
    (field) => PROFILE_COMPLETION_FIELD_LABELS_ES[field],
  );
}

/** English labels of empty fields (member UI). */
export function listMissingProfileFieldsEn(profile: ProfileCompletionInput): string[] {
  return PROFILE_COMPLETION_FIELDS.filter((field) => !isFieldFilled(profile, field)).map(
    (field) => PROFILE_COMPLETION_FIELD_LABELS_EN[field],
  );
}

/** Locale-aware missing-field labels for member UI. */
export function listMissingProfileFieldsForLocale(
  profile: ProfileCompletionInput,
  locale: string,
): string[] {
  if (locale === "fr") return listMissingProfileFieldsFr(profile);
  if (locale === "en") return listMissingProfileFieldsEn(profile);
  return listMissingProfileFieldsEs(profile);
}

/** True when the profile is not fully filled (cannot be curated at 100%). */
export function isProfileIncomplete(profile: ProfileCompletionInput): boolean {
  return computeProfileCompletionPercent(profile) < 100;
}

/** Calendar month key for monthly nudge idempotency (America/Mexico_City). */
export function currentNudgeMonthKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function isExpressSignup(profile: Pick<ProfileCompletionInput, "source" | "profileComplete">): boolean {
  if (profile.profileComplete === false) return true;
  const source = (profile.source ?? "").toLowerCase();
  return source.includes("express") || source.includes("light");
}
