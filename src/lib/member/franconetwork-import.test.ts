import { describe, expect, it } from "vitest";
import {
  computeFranconetworkProfileComplete,
  mapFnProfileToWaitlist,
} from "@/lib/member/franconetwork-import";

describe("isFranconetworkDirectoryVisible", () => {
  it("matches FrancoNetwork annuaire visibility", async () => {
    const { isFranconetworkDirectoryVisible } = await import(
      "@/lib/member/franconetwork-import"
    );
    expect(isFranconetworkDirectoryVisible({ isValidated: true })).toBe(true);
    expect(isFranconetworkDirectoryVisible({ isValidated: undefined })).toBe(true);
    expect(isFranconetworkDirectoryVisible({ isValidated: null })).toBe(true);
    expect(isFranconetworkDirectoryVisible({ isValidated: false })).toBe(false);
  });
});

describe("mapFnProfileToWaitlist", () => {
  it("returns null without email or fullName", () => {
    expect(mapFnProfileToWaitlist({ fullName: "Ada", email: "" })).toBeNull();
    expect(mapFnProfileToWaitlist({ fullName: "", email: "a@b.com" })).toBeNull();
  });

  it("maps FN fields to waitlist shape", () => {
    const record = mapFnProfileToWaitlist({
      fullName: " Ana García ",
      email: "Ana@Example.COM",
      whatsapp: "+52 33 1234 5678",
      companyName: "Acme",
      activityCategory: "Tech & digital",
      positionCategory: "Fondateur",
      city: "Guadalajara",
      linkedin: "https://www.linkedin.com/in/ana",
      networkGoal: "Rencontres stratégiques",
      communicationLanguage: "fr",
    });

    expect(record).not.toBeNull();
    expect(record!.email).toBe("ana@example.com");
    expect(record!.fullName).toBe("Ana García");
    expect(record!.phone).toBe("+52 33 1234 5678");
    expect(record!.company).toBe("Acme");
    expect(record!.sector).toBe("Tech & digital");
    expect(record!.position).toBe("Fondateur");
    expect(record!.city).toBe("Guadalajara");
    expect(record!.linkedinUrl).toBe("https://www.linkedin.com/in/ana");
    expect(record!.invitationMotivation).toBe("Rencontres stratégiques");
    expect(record!.locale).toBe("fr");
    expect(record!.source).toBe("franconetwork");
    expect(record!.tags).toContain("franconetwork");
    expect(record!.extraActivities).toEqual([]);
    expect(record!.profileComplete).toBe(true);
  });

  it("falls back motivation and locale", () => {
    const record = mapFnProfileToWaitlist({
      fullName: "Bob",
      email: "bob@ex.com",
      memberBio: "Bio courte",
    });
    expect(record!.invitationMotivation).toBe("Bio courte");
    expect(record!.locale).toBe("es");
    expect(record!.profileComplete).toBe(false);
  });
});

describe("computeFranconetworkProfileComplete", () => {
  it("requires name, email and at least 3 enrichment signals", () => {
    expect(
      computeFranconetworkProfileComplete({
        fullName: "A",
        email: "a@b.com",
        phone: "1",
        company: "c",
        sector: "",
        position: "",
        city: "",
        linkedinUrl: "",
        invitationMotivation: "",
      }),
    ).toBe(false);

    expect(
      computeFranconetworkProfileComplete({
        fullName: "A",
        email: "a@b.com",
        phone: "1",
        company: "c",
        sector: "s",
        position: "",
        city: "",
        linkedinUrl: "",
        invitationMotivation: "",
      }),
    ).toBe(true);
  });
});
