/** Extract / normalize public LinkedIn profile URLs for member forms. */

const PROFILE_PATH_RE = /linkedin\.com\/(in|pub)\/[^/?#\s]+/i;

/** Pull a linkedin.com URL out of messy clipboard paste (labels, extra words). */
function extractLinkedInCandidate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const urlMatch = trimmed.match(
    /https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[^\s<>"']+/i,
  );
  if (urlMatch?.[0]) return urlMatch[0].replace(/[),.;]+$/g, "");

  const bareMatch = trimmed.match(
    /(?:[\w-]+\.)?linkedin\.com\/(?:in|pub)\/[^\s<>"']+/i,
  );
  if (bareMatch?.[0]) return bareMatch[0].replace(/[),.;]+$/g, "");

  return trimmed;
}

export function normalizeLinkedInUrl(raw: string): string {
  const candidate = extractLinkedInCandidate(raw);
  if (!candidate) return "";

  try {
    const withProtocol = /^https?:\/\//i.test(candidate)
      ? candidate
      : `https://${candidate}`;
    const url = new URL(withProtocol);
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return "";
    if (!PROFILE_PATH_RE.test(`${url.hostname}${url.pathname}`)) return "";

    // Keep a clean canonical profile URL (drop tracking query / hash).
    const path = url.pathname.replace(/\/+$/, "");
    return `https://www.linkedin.com${path}`;
  } catch {
    return "";
  }
}

export function isValidLinkedInUrl(raw: string): boolean {
  const normalized = normalizeLinkedInUrl(raw);
  return PROFILE_PATH_RE.test(normalized);
}
