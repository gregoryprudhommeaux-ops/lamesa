/** Relative app path only — blocks open redirects. */

export function safeMemberNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return null;
  if (path.includes("\\")) return null;
  // Admin lives outside [locale]
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  return path;
}

export function safeAdminNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (!path.startsWith("/admin") || path.startsWith("//") || path.includes("://")) return null;
  if (path.includes("\\")) return null;
  if (path === "/admin/login" || path.startsWith("/admin/login?")) return null;
  return path;
}

export function withNextQuery(loginHref: string, nextPath: string): string {
  const sep = loginHref.includes("?") ? "&" : "?";
  return `${loginHref}${sep}next=${encodeURIComponent(nextPath)}`;
}
