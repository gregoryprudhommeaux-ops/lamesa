import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabasePersoError } from "@/lib/database-perso";
import {
  syncWaitlistMemberToDatabasePerso,
  toDatabasePersoUpsertPayload,
} from "./sync-database-perso";

vi.mock("@/lib/database-perso", async () => {
  const actual = await vi.importActual<typeof import("@/lib/database-perso")>(
    "@/lib/database-perso",
  );
  return {
    ...actual,
    isDatabasePersoConfigured: vi.fn(() => true),
    upsertContact: vi.fn(),
  };
});

import { isDatabasePersoConfigured, upsertContact } from "@/lib/database-perso";

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
    expect(payload.laMesaRegistered).toBe(true);
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

describe("syncWaitlistMemberToDatabasePerso", () => {
  beforeEach(() => {
    vi.mocked(isDatabasePersoConfigured).mockReturnValue(true);
    vi.mocked(upsertContact).mockReset();
  });

  it("returns ok with id on successful upsert", async () => {
    vi.mocked(upsertContact).mockResolvedValue({ ok: true, id: "c1", action: "created" });
    const result = await syncWaitlistMemberToDatabasePerso(baseMember);
    expect(result).toEqual({ ok: true, id: "c1" });
  });

  it("retries once on timeout then succeeds", async () => {
    vi.mocked(upsertContact)
      .mockRejectedValueOnce(new DatabasePersoError("Request timeout", "timeout"))
      .mockResolvedValueOnce({ ok: true, id: "c2", action: "merged" });

    const result = await syncWaitlistMemberToDatabasePerso(baseMember);
    expect(result).toEqual({ ok: true, id: "c2" });
    expect(upsertContact).toHaveBeenCalledTimes(2);
  });

  it("returns failed with error after exhausted retry", async () => {
    vi.mocked(upsertContact).mockRejectedValue(
      new DatabasePersoError("Upstream error 503: down", "upstream", 503),
    );

    const result = await syncWaitlistMemberToDatabasePerso(baseMember);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/upstream:503/);
    expect(upsertContact).toHaveBeenCalledTimes(2);
  });

  it("skips when email and phone are missing", async () => {
    const result = await syncWaitlistMemberToDatabasePerso({
      ...baseMember,
      email: "  ",
      phone: "",
    });
    expect(result).toEqual({
      ok: false,
      skipped: true,
      error: "missing_email_and_phone",
    });
    expect(upsertContact).not.toHaveBeenCalled();
  });
});
