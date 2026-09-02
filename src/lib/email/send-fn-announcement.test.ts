import { describe, expect, it } from "vitest";
import { buildFnAnnouncementProfileMatchNote } from "@/lib/email/send-fn-announcement";

describe("buildFnAnnouncementProfileMatchNote", () => {
  it("returns 100% note when profile is complete", () => {
    const meta = buildFnAnnouncementProfileMatchNote({
      fullName: "Ada Lovelace",
      email: "ada@ex.com",
      phone: "+521234567890",
      company: "Co",
      sector: "tech",
      position: "CEO",
      city: "Guadalajara",
      linkedinUrl: "https://linkedin.com/in/ada",
      invitationMotivation: "Quiero conocer operadores locales",
      extraActivities: ["software"],
      canBring: "contactos",
      isSeeking: "inversión",
    });
    expect(meta.profilePercent).toBe("100");
    expect(meta.profileMatchNote).toContain("100%");
    expect(meta.missingFields).toBe("algunos datos");
  });

  it("lists missing fields when profile is incomplete", () => {
    const meta = buildFnAnnouncementProfileMatchNote({
      fullName: "Bob",
      email: "bob@ex.com",
      company: "Co",
    });
    expect(Number(meta.profilePercent)).toBeLessThan(100);
    expect(meta.profileMatchNote).toContain("Hoy falta:");
    expect(meta.missingFields.length).toBeGreaterThan(0);
  });
});
