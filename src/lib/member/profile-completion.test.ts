import { describe, expect, it } from "vitest";
import {
  computeProfileCompletionPercent,
  isExpressSignup,
  listMissingProfileFieldsFr,
} from "./profile-completion";

describe("computeProfileCompletionPercent", () => {
  it("returns 0 for empty profile", () => {
    expect(computeProfileCompletionPercent({})).toBe(0);
    expect(listMissingProfileFieldsFr({})).toEqual([
      "nom",
      "email",
      "téléphone",
      "entreprise",
      "secteur",
      "poste",
      "ville",
      "LinkedIn",
      "motivation",
      "activités",
    ]);
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
    const full = {
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
    };
    expect(computeProfileCompletionPercent(full)).toBe(100);
    expect(listMissingProfileFieldsFr(full)).toEqual([]);
  });

  it("lists only missing fields for a near-complete profile", () => {
    expect(
      listMissingProfileFieldsFr({
        fullName: "Ada",
        email: "ada@example.com",
        phone: "+521111111111",
        company: "Acme",
        sector: "tech",
        position: "founder",
        city: "GDL",
        linkedinUrl: "https://linkedin.com/in/ada",
        invitationMotivation: "Curiosity",
      }),
    ).toEqual(["activités"]);
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
