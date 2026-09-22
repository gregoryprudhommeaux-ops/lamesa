import { getSiteUrl } from "@/lib/site-url";

/** Email-safe RSVP click URL (token in query — less mangled than path + long query). */
export function buildRsvpClickUrl(input: {
  token: string;
  response: "yes" | "no";
  locale: string;
  baseUrl?: string;
}): string {
  const base = (input.baseUrl ?? getSiteUrl()).replace(/\/+$/, "");
  const q = new URLSearchParams({
    t: input.token,
    r: input.response,
    l: input.locale.slice(0, 2),
  });
  return `${base}/api/rsvp/go?${q.toString()}`;
}

/** Normalize token from path or query (handles one extra encodeURIComponent layer). */
export function normalizeRsvpTokenParam(raw: string | null | undefined): string {
  let token = String(raw ?? "").trim();
  if (!token) return "";
  try {
    // Path params are often already decoded; decode once more if still percent-encoded.
    if (/%[0-9A-Fa-f]{2}/.test(token)) {
      token = decodeURIComponent(token);
    }
  } catch {
    /* keep raw */
  }
  return token.trim();
}
