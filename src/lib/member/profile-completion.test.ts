import { describe, expect, it } from "vitest";
import {
  computeProfileCompletionPercent,
  currentNudgeMonthKey,
  isExpressSignup,
  isProfileIncomplete,
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
      "secteur (préciser si Autre)",
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

  it("does not count sector=other without sectorOther", () => {
    const profile = {
      fullName: "Ada",
      email: "ada@example.com",
      phone: "+521111111111",
      company: "Acme",
      sector: "other",
      position: "founder",
      city: "GDL",
      linkedinUrl: "https://linkedin.com/in/ada",
      invitationMotivation: "Curiosity",
      extraActivities: ["networking"],
      canBring: "B2B",
      isSeeking: "Partners",
    };
    expect(computeProfileCompletionPercent(profile)).toBeLessThan(100);
    expect(listMissingProfileFieldsFr(profile)).toContain("secteur (préciser si Autre)");
  });

  it("counts sector=other when sectorOther is filled", () => {
    expect(
      computeProfileCompletionPercent({
        fullName: "Ada",
        email: "ada@example.com",
        phone: "+521111111111",
        company: "Acme",
        sector: "other",
        sectorOther: "Energía renovable",
        position: "founder",
        city: "GDL",
        linkedinUrl: "https://linkedin.com/in/ada",
        invitationMotivation: "Curiosity",
        extraActivities: ["networking"],
        canBring: "B2B",
        isSeeking: "Partners",
      }),
    ).toBe(100);
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

describe("isProfileIncomplete", () => {
  it("is true under 100%", () => {
    expect(isProfileIncomplete({ fullName: "A", email: "a@b.com" })).toBe(true);
  });

  it("is false at 100%", () => {
    expect(
      isProfileIncomplete({
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
        canBring: "B2B",
        isSeeking: "Partners",
      }),
    ).toBe(false);
  });
});

describe("currentNudgeMonthKey", () => {
  it("returns YYYY-MM in Mexico City", () => {
    expect(currentNudgeMonthKey(new Date("2026-08-01T20:00:00.000Z"))).toBe("2026-08");
    // Still July evening in GDL when UTC is Aug 1 05:00
    expect(currentNudgeMonthKey(new Date("2026-08-01T05:00:00.000Z"))).toBe("2026-07");
  });
});
