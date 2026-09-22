import { describe, expect, it } from "vitest";
import { buildRsvpClickUrl, normalizeRsvpTokenParam } from "@/lib/email/rsvp-links";
import { signRsvpToken, verifyRsvpToken } from "@/lib/email/rsvp-token";

describe("rsvp-links", () => {
  it("builds query-style click URLs", () => {
    const token = signRsvpToken({
      participationId: "p1",
      eventId: "e1",
      email: "a@b.com",
    });
    const url = buildRsvpClickUrl({
      token,
      response: "yes",
      locale: "fr",
      baseUrl: "https://lamesasecreta.com",
    });
    expect(url).toContain("https://lamesasecreta.com/api/rsvp/go?");
    expect(url).toContain("r=yes");
    expect(url).toContain("l=fr");
    const parsed = new URL(url);
    expect(verifyRsvpToken(parsed.searchParams.get("t") ?? "")).toMatchObject({
      participationId: "p1",
      eventId: "e1",
    });
  });

  it("normalizes once-encoded tokens", () => {
    const token = signRsvpToken({
      participationId: "p1",
      eventId: "e1",
      email: "a@b.com",
    });
    expect(normalizeRsvpTokenParam(encodeURIComponent(token))).toBe(token);
    expect(normalizeRsvpTokenParam(token)).toBe(token);
  });
});
