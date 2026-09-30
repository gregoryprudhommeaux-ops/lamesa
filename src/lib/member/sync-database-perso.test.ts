import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabasePersoError } from "@/lib/database-perso";
import type { DatabasePersoContact } from "@/lib/types/events";
import {
  buildEnrichmentPatchFromPerso,
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
    findContactByEmail: vi.fn(),
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
  updatedAt: "2026-09-10T12:00:00.000Z",
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
    expect(payload.mergePolicy).toBe("prefer_incoming");
    expect(payload.notesMode).toBe("append");
  });

  it("sanitizes messy phone and LinkedIn before upsert", () => {
    const payload = toDatabasePersoUpsertPayload({
      ...baseMember,
      phone: "+523313457394 (Whatsapp only)",
      linkedinUrl: "www.linkedin.com/in/ada-lovelace",
    });
    expect(payload.phones).toEqual(["+523313457394"]);
    expect(payload.linkedinUrl).toBe("https://www.linkedin.com/in/ada-lovelace");
  });

  it("adds curation answers to Database Perso notes", () => {
    const payload = toDatabasePersoUpsertPayload({
      ...baseMember,
      canBring: "Experiencia SaaS",
      isSeeking: "Socios comerciales",
      dinnerThemesInterest: "Scale B2B y climate",
    });

    expect(payload.notes).toContain("Puede aportar: Experiencia SaaS");
    expect(payload.notes).toContain("Busca: Socios comerciales");
    expect(payload.notes).toContain("Thématiques dîners: Scale B2B y climate");
  });
});

describe("buildEnrichmentPatchFromPerso", () => {
  const member = {
    fullName: "Ada",
    linkedinUrl: "",
    company: "",
    sector: "tech",
    position: "",
    city: "",
    phone: "",
    extraActivities: [] as string[],
    opsNotes: "",
    updatedAt: "2026-09-01T00:00:00.000Z",
    databasePersoContactId: undefined as string | undefined,
  };

  const contact: DatabasePersoContact = {
    id: "perso-1",
    fullName: "Ada Lovelace",
    company: "Analytical Engines",
    emails: ["ada@example.com"],
    phones: ["+521111111111"],
    tags: ["la-mesa"],
    linkedinUrl: "https://www.linkedin.com/in/ada",
    sector: "finance",
    position: "founder",
    city: "Guadalajara",
    notes: "LinkedIn scan: PE / FO network",
    updatedAt: "2026-09-20T00:00:00.000Z",
  };

  it("fills empty LA MESA fields from Perso", () => {
    const patch = buildEnrichmentPatchFromPerso(member, contact);
    expect(patch.linkedinUrl).toContain("linkedin.com/in/ada");
    expect(patch.company).toBe("Analytical Engines");
    expect(patch.city).toBe("Guadalajara");
    expect(patch.opsNotes).toContain("[Perso]");
    expect(patch.opsNotes).toContain("PE / FO");
  });

  it("lets newer Perso values overwrite existing LA MESA fields", () => {
    const patch = buildEnrichmentPatchFromPerso(
      { ...member, sector: "tech", company: "Old Co" },
      contact,
    );
    expect(patch.sector).toBe("finance");
    expect(patch.company).toBe("Analytical Engines");
  });

  it("does not overwrite when LA MESA is newer", () => {
    const patch = buildEnrichmentPatchFromPerso(
      {
        ...member,
        company: "LA MESA Co",
        sector: "tech",
        updatedAt: "2026-09-25T00:00:00.000Z",
      },
      contact,
    );
    expect(patch.company).toBeUndefined();
    expect(patch.sector).toBeUndefined();
    expect(patch.linkedinUrl).toBeTruthy();
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

  it("retries on timeout then succeeds", async () => {
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
    expect(upsertContact).toHaveBeenCalledTimes(3);
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
