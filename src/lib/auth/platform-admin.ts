/** Admin platform access — LA MESA (mirrors Ultra Content Maker pattern). */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const DEFAULT_ADMIN_EMAILS = ["gregory.prudhommeaux@gmail.com"] as const;

function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function configuredAdminEmails(): readonly string[] {
  const fromEnv = parseList(process.env.NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS).map(normalizeEmail);
  return [...new Set([...DEFAULT_ADMIN_EMAILS, ...fromEnv])];
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return configuredAdminEmails().includes(normalizeEmail(email));
}

export function isPlatformAdminIdentity(input: {
  email?: string | null;
}): boolean {
  return isPlatformAdminEmail(input.email);
}
