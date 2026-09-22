/**
 * Waitlist rows created by admin email blasts / invite ops — NOT self-signups.
 * Contacting someone must never make them an "inscrit LA MESA".
 */
export const ADMIN_PROVISIONED_WAITLIST_SOURCES = [
  "la-mesa-places-available",
  "la-mesa-std-invite",
] as const;

export type AdminProvisionedWaitlistSource =
  (typeof ADMIN_PROVISIONED_WAITLIST_SOURCES)[number];

export function isAdminProvisionedWaitlistSource(
  source: string | null | undefined,
): source is AdminProvisionedWaitlistSource {
  const key = (source ?? "").trim().toLowerCase();
  return (ADMIN_PROVISIONED_WAITLIST_SOURCES as readonly string[]).includes(key);
}

/**
 * Stub created by an admin blast/invite. Once the person completes a real profile
 * (`profileComplete === true`), they count as a legitimate member.
 *
 * Note: do NOT key off `interest-auto` tags — those also appear on
 * `la-mesa-interest` stubs created when the person themselves authenticates.
 */
export function isAdminProvisionedWaitlistStub(row: {
  source?: string | null;
  profileComplete?: boolean | null;
}): boolean {
  if (row.profileComplete === true) return false;
  return isAdminProvisionedWaitlistSource(row.source);
}

/** Active waitlist member who signed up themselves (or completed a stub). */
export function isLegitimateWaitlistMember(row: {
  deletedAt?: string | null;
  source?: string | null;
  profileComplete?: boolean | null;
}): boolean {
  if (row.deletedAt && String(row.deletedAt).trim()) return false;
  return !isAdminProvisionedWaitlistStub(row);
}
