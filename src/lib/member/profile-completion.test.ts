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
      "ce qu’il peut apporter",
      "ce qu’il recherche",
    ]);
  });

  it("scores express signup fields (name, email, phone)", () => {
    expect(
      computeProfileCompletionPercent({
        fullName: "Test User",
        email: "a@b.com",
        phone: "+521234567890",
      }),
    ).toBe(25);
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
      canBring: "B2B product experience",
      isSeeking: "Distribution partners in Mexico",
    };
    expect(computeProfileCompletionPercent(full)).toBe(100);
    expect(listMissingProfileFieldsFr(full)).toEqual([]);
  });

  it("counts canBring and isSeeking in profile completion", () => {
    const complete = {
      fullName: "Ana García",
      email: "ana@example.com",
      phone: "+521234567890",
      company: "Mesa Labs",
      sector: "tech",
      position: "founder",
      city: "Guadalajara",
      linkedinUrl: "https://linkedin.com/in/ana",
      invitationMotivation: "Conocer perfiles complementarios",
      extraActivities: ["Mentoría"],
      canBring: "Experiencia en producto B2B",
      isSeeking: "Socios de distribución en México",
    };
    expect(computeProfileCompletionPercent(complete)).toBe(100);
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
        canBring: "B2B product experience",
        isSeeking: "Distribution partners",
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
