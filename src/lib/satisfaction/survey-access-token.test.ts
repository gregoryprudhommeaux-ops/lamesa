import { describe, expect, it } from "vitest";
import {
  createSurveyAccessToken,
  isOpaqueSurveyAccessToken,
} from "@/lib/satisfaction/survey-access-token";
import { signSurveyToken } from "@/lib/email/rsvp-token";

describe("survey-access-token", () => {
  it("creates short opaque tokens without dots", () => {
    const a = createSurveyAccessToken();
    const b = createSurveyAccessToken();
    expect(a).not.toEqual(b);
    expect(a.includes(".")).toBe(false);
    expect(isOpaqueSurveyAccessToken(a)).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a.length).toBeLessThanOrEqual(64);
  });

  it("does not treat legacy HMAC survey tokens as opaque", () => {
    const hmac = signSurveyToken({
      participationId: "p1",
      eventId: "e1",
      email: "sophie@example.com",
    });
    expect(hmac.includes(".")).toBe(true);
    expect(isOpaqueSurveyAccessToken(hmac)).toBe(false);
  });
});
