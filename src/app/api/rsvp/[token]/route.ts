import { normalizeRsvpTokenParam } from "@/lib/email/rsvp-links";
import { processRsvpClick } from "@/lib/email/process-rsvp-click";

type Params = { params: Promise<{ token: string }> };

/** Legacy path-style RSVP links: /api/rsvp/{token}?response=yes&locale=fr */
export async function GET(request: Request, { params }: Params) {
  const { token: raw } = await params;
  const url = new URL(request.url);
  const token = normalizeRsvpTokenParam(raw);
  const response = String(url.searchParams.get("response") ?? "").toLowerCase();
  const locale = String(url.searchParams.get("locale") ?? "fr").slice(0, 2);
  return processRsvpClick({
    token,
    response,
    locale,
    requestUrl: request.url,
  });
}
