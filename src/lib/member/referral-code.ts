const SUFFIX_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Prefixes use the first 4 letters of the first name (accent-stripped, uppercased).
export function firstNameToken(fullName: string): string {
  const first = (fullName.trim().split(/\s+/)[0] ?? "USER")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  return first.slice(0, 4) || "USER";
}

export function randomSuffix(len = 2, rng: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += SUFFIX_CHARS[Math.floor(rng() * SUFFIX_CHARS.length)]!;
  }
  return out;
}

export function buildReferralCode(
  fullName: string,
  suffixFactory: () => string = () => randomSuffix(2),
): string {
  return `${firstNameToken(fullName)}-${suffixFactory()}`;
}

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidReferralCodeFormat(code: string): boolean {
  return /^[A-Z]{2,4}-[A-Z0-9]{2,4}$/.test(normalizeReferralCode(code));
}
