export function normalizeLinkedInUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (!url.hostname.includes("linkedin.com")) return "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function isValidLinkedInUrl(raw: string): boolean {
  const normalized = normalizeLinkedInUrl(raw);
  return /linkedin\.com\/(in|pub)\//i.test(normalized);
}
