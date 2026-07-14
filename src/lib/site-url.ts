/** Canonical public site URL for LA MESA (emails, redirects, share links). */
export const PRODUCTION_SITE_URL = "https://lamesasecreta.com";

/**
 * Resolve the public base URL (no trailing slash).
 * Prefer NEXT_PUBLIC_APP_URL; fall back to production domain on Vercel, else local.
 */
export function getSiteUrl(requestUrl?: string): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  if (process.env.VERCEL_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;

  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      /* ignore */
    }
  }

  return "http://127.0.0.1:3000";
}
