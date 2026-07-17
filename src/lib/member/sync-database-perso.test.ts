import { describe, expect, it } from "vitest";
import { toDatabasePersoUpsertPayload } from "./sync-database-perso";

const baseMember = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+521111111111",
  company: "Analytical",
  sector: "tech",
  position: "founder",
  city: "GDL",
  linkedinUrl: "https://linkedin.com/in/ada",
  extraActivities: ["AI"],
  invitationMotivation: "Curious",
  locale: "es",
  source: "la-mesa-registration",
  tags: ["la-mesa", "waitlist"],
  referredByCode: "GREG01",
};

describe("toDatabasePersoUpsertPayload", () => {
  it("maps waitlist fields for Database Perso upsert", () => {
    const payload = toDatabasePersoUpsertPayload(baseMember);

    expect(payload.emails).toEqual(["ada@example.com"]);
    expect(payload.phones).toEqual(["+521111111111"]);
    expect(payload.company).toBe("Analytical");
    expect(payload.notes).toContain("Parrainé via: GREG01");
    expect(payload.notes).toContain("Motivation: Curious");
  });

  it("adds curation answers to Database Perso notes", () => {
    const payload = toDatabasePersoUpsertPayload({
      ...baseMember,
      canBring: "Experiencia SaaS",
      isSeeking: "Socios comerciales",
    });

    expect(payload.notes).toContain("Puede aportar: Experiencia SaaS");
    expect(payload.notes).toContain("Busca: Socios comerciales");
  });
});
