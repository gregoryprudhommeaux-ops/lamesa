import { normalizeRsvpTokenParam } from "@/lib/email/rsvp-links";
import { processRsvpClick } from "@/lib/email/process-rsvp-click";

/** Preferred RSVP endpoint for emails: /api/rsvp/go?t=…&r=yes|no&l=fr */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = normalizeRsvpTokenParam(url.searchParams.get("t"));
  const response = String(url.searchParams.get("r") ?? "").toLowerCase();
  const locale = String(url.searchParams.get("l") ?? "fr").slice(0, 2);
  return processRsvpClick({
    token,
    response,
    locale,
    requestUrl: request.url,
  });
}
