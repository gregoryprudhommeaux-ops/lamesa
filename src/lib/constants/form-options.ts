export const SECTORS = [
  "tech",
  "finance",
  "real_estate",
  "consulting",
  "health",
  "hospitality",
  "legal",
  "marketing",
  "manufacturing",
  "retail",
  "education",
  "energy",
  "logistics",
  "construction",
  "agri_food",
  "media",
  "automotive",
  "trade",
  "nonprofit",
  "hr",
  "other",
] as const;

export type SectorCode = (typeof SECTORS)[number];

export function isSectorCode(value: string | null | undefined): value is SectorCode {
  return Boolean(value && (SECTORS as readonly string[]).includes(value));
}

export function isOtherSector(value: string | null | undefined): boolean {
  return (value ?? "").trim() === "other";
}

export const POSITIONS = [
  "founder",
  "ceo",
  "director",
  "manager",
  "investor",
  "consultant",
  "other",
] as const;

export const DRESS_CODES = [
  "casual",
  "smart_casual",
  "business",
  "formal",
  "traditional",
  "none_specified",
] as const;

export const PARKING_OPTIONS = ["secure_nearby", "valet", "on_site", "unknown"] as const;
