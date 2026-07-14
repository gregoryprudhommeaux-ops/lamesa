import { describe, expect, it } from "vitest";
import {
  computeProfileCompletionPercent,
  isExpressSignup,
} from "./profile-completion";

describe("computeProfileCompletionPercent", () => {
  it("returns 0 for empty profile", () => {
    expect(computeProfileCompletionPercent({})).toBe(0);
  });

  it("scores express signup fields (name, email, phone)", () => {
    expect(
      computeProfileCompletionPercent({
        fullName: "Test User",
        email: "a@b.com",
        phone: "+521234567890",
      }),
    ).toBe(30);
  });

  it("returns 100 when all fields filled", () => {
    expect(
      computeProfileCompletionPercent({
        fullName: "Ada",
        email: "ada@example.com",
        phone: "+521111111111",
        company: "Acme",
        sector: "tech",
        position: "founder",
        city: "GDL",
        linkedinUrl: "https://linkedin.com/in/ada",
        invitationMotivation: "Curiosity",
        extraActivities: ["networking"],
      }),
    ).toBe(100);
  });
});

describe("isExpressSignup", () => {
  it("detects express from flag or source", () => {
    expect(isExpressSignup({ profileComplete: false })).toBe(true);
    expect(isExpressSignup({ source: "la-mesa-express" })).toBe(true);
    expect(isExpressSignup({ source: "la-mesa-registration", profileComplete: true })).toBe(
      false,
    );
  });
});
