import { describe, expect, it } from "vitest";
import type { TableCandidate } from "./types";
import { rankCandidates, selectBalancedTable, TABLE_SCORE } from "./score";

const candidate = (
  overrides: Partial<TableCandidate> = {},
): TableCandidate => ({
  id: "member-1",
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  company: "Analytical Engines",
  sector: "Technology",
  position: "Founder",
  city: "Mexico City",
  invitationMotivation: "Meet founders",
  extraActivities: [],
  canBring: "Introductions",
  isSeeking: "Cofounder",
  completionPercent: 90,
  completionBand: "high",
  invitationCount: 0,
  invitedToPreviousEvent: false,
  coPresentMemberIds: [],
  ...overrides,
});

describe("rankCandidates", () => {
  it("ranks a never-invited complete profile ahead of a previous-table invitee", () => {
    const ranked = rankCandidates([
      candidate({
        id: "previous-invitee",
        invitedToPreviousEvent: true,
        invitationCount: 2,
        completionBand: "low",
        completionPercent: 40,
      }),
      candidate({
        id: "fresh-member",
        invitedToPreviousEvent: false,
        invitationCount: 0,
        completionBand: "high",
        completionPercent: 95,
      }),
    ]);

    expect(ranked[0].id).toBe("fresh-member");
    expect(ranked[1].id).toBe("previous-invitee");
    expect(ranked[0].baseScore).toBeGreaterThan(ranked[1].baseScore);
    expect(ranked[0].reasons).toContain("not invited to previous event");
    expect(ranked[0].reasons).toContain("never invited");
    expect(ranked[1].reasons).toContain("invited to previous event");
  });

  it("does not use locale in scoring", () => {
    const base = candidate({
      id: "member-a",
      fullName: "Nombre Español",
      company: "Empresa México",
      invitationMotivation: "Conocer fundadores",
    });
    const twin = candidate({
      id: "member-b",
      fullName: "English Name",
      company: "Empresa México",
      invitationMotivation: "Meet founders",
    });

    const [rankedA, rankedB] = rankCandidates([base, twin]);

    expect(rankedA.baseScore).toBe(rankedB.baseScore);
    expect(rankedA.reasons).toEqual(rankedB.reasons);
  });

  it("deduplicates candidate ids before ranking, keeping the first occurrence", () => {
    const ranked = rankCandidates([
      candidate({
        id: "dup",
        company: "First Co",
        completionBand: "high",
        completionPercent: 90,
      }),
      candidate({
        id: "dup",
        company: "Second Co",
        completionBand: "low",
        completionPercent: 20,
        invitationCount: 3,
        invitedToPreviousEvent: true,
      }),
      candidate({ id: "unique", company: "Unique Co" }),
    ]);

    expect(ranked.map(({ id }) => id)).toEqual(["dup", "unique"]);
    expect(ranked[0].company).toBe("First Co");
    expect(ranked).toHaveLength(2);
  });

  it("tie-breaks equal scores with stable code-point id order", () => {
    const ranked = rankCandidates([
      candidate({ id: "member-b", company: "B Co" }),
      candidate({ id: "member-a", company: "A Co" }),
      candidate({ id: "member-c", company: "C Co" }),
    ]);

    expect(ranked.every((entry) => entry.baseScore === ranked[0].baseScore)).toBe(true);
    expect(ranked.map(({ id }) => id)).toEqual(["member-a", "member-b", "member-c"]);
  });
});

describe("selectBalancedTable", () => {
  it("prefers one member per normalized company", () => {
    const ranked = rankCandidates([
      candidate({ id: "acme-1", company: "Acme Corp" }),
      candidate({ id: "acme-2", company: "  ACME CORP " }),
      candidate({ id: "beta-1", company: "Beta LLC" }),
    ]);

    const { primary } = selectBalancedTable(ranked, { primarySize: 2, alternateSize: 0 });

    expect(primary.map(({ id }) => id)).toEqual(["acme-1", "beta-1"]);
  });

  it("soft-limits a sector to four primary seats when alternatives exist", () => {
    const financeMembers = Array.from({ length: 6 }, (_, index) =>
      candidate({
        id: `finance-${index + 1}`,
        sector: "Finance",
        company: `Finance Co ${index + 1}`,
      }),
    );
    const otherMembers = Array.from({ length: 12 }, (_, index) =>
      candidate({
        id: `other-${index + 1}`,
        sector: `Sector ${index + 1}`,
        company: `Other Co ${index + 1}`,
      }),
    );

    const ranked = rankCandidates([...financeMembers, ...otherMembers]);
    const { primary } = selectBalancedTable(ranked, { primarySize: 15, alternateSize: 0 });

    const financeCount = primary.filter(({ sector }) => sector === "Finance").length;
    expect(financeCount).toBeLessThanOrEqual(4);
    expect(primary).toHaveLength(15);
  });

  it("returns 15 primary and 5 alternates for a pool of 20", () => {
    const pool = Array.from({ length: 20 }, (_, index) =>
      candidate({
        id: `member-${index + 1}`,
        company: `Company ${index + 1}`,
        sector: `Sector ${(index % 5) + 1}`,
      }),
    );

    const ranked = rankCandidates(pool);
    const { primary, alternates, warnings } = selectBalancedTable(ranked);

    expect(primary).toHaveLength(15);
    expect(alternates).toHaveLength(5);
    expect(warnings.some((warning) => warning.includes("pool too small"))).toBe(false);
  });

  it("returns all available members with a pool-too-small warning", () => {
    const pool = Array.from({ length: 10 }, (_, index) =>
      candidate({
        id: `member-${index + 1}`,
        company: `Company ${index + 1}`,
        sector: `Sector ${index + 1}`,
      }),
    );

    const ranked = rankCandidates(pool);
    const { primary, alternates, warnings } = selectBalancedTable(ranked);

    expect(primary).toHaveLength(10);
    expect(alternates).toHaveLength(0);
    expect(warnings.some((warning) => warning.includes("pool too small"))).toBe(true);
  });

  it("warns when a referral pair appears in primary", () => {
    const ranked = rankCandidates([
      candidate({ id: "referrer", company: "Referrer Co" }),
      candidate({
        id: "referral",
        company: "Referral Co",
        referredById: "referrer",
      }),
    ]);

    const { primary, warnings } = selectBalancedTable(ranked, {
      primarySize: 2,
      alternateSize: 0,
    });

    expect(primary.map(({ id }) => id).sort()).toEqual(["referral", "referrer"]);
    expect(warnings.some((warning) => warning.includes("referral pair"))).toBe(true);
  });

  it("deduplicates ranked ids so duplicates cannot occupy multiple seats", () => {
    const ranked = [
      ...rankCandidates([candidate({ id: "dup", company: "First Co" })]),
      ...rankCandidates([
        candidate({
          id: "dup",
          company: "Second Co",
          completionBand: "low",
          completionPercent: 20,
        }),
      ]),
      ...rankCandidates([candidate({ id: "other", company: "Other Co" })]),
    ];

    const { primary, alternates, warnings } = selectBalancedTable(ranked, {
      primarySize: 2,
      alternateSize: 1,
    });

    const seatedIds = [...primary, ...alternates].map(({ id }) => id);
    expect(seatedIds).toEqual(["dup", "other"]);
    expect(new Set(seatedIds).size).toBe(seatedIds.length);
    expect(primary[0].company).toBe("First Co");
    expect(warnings.some((warning) => warning.includes("pool too small"))).toBe(true);
    expect(warnings.some((warning) => warning.includes("2 eligible members"))).toBe(true);
  });

  it("normalizes sectors and ignores blank sectors for the soft cap", () => {
    const blankSectorMembers = Array.from({ length: 6 }, (_, index) =>
      candidate({
        id: `blank-${index + 1}`,
        sector: "",
        company: `Blank Co ${index + 1}`,
      }),
    );
    const financeMembers = Array.from({ length: 6 }, (_, index) =>
      candidate({
        id: `finance-${index + 1}`,
        sector: index % 2 === 0 ? "Finance" : "  FINANCE ",
        company: `Finance Co ${index + 1}`,
      }),
    );
    const diversifiers = Array.from({ length: 8 }, (_, index) =>
      candidate({
        id: `other-${index + 1}`,
        sector: `Sector ${index + 1}`,
        company: `Other Co ${index + 1}`,
      }),
    );

    const ranked = rankCandidates([
      ...blankSectorMembers,
      ...financeMembers,
      ...diversifiers,
    ]);
    const { primary } = selectBalancedTable(ranked, {
      primarySize: 15,
      alternateSize: 0,
    });

    const blankCount = primary.filter(({ sector }) => sector.trim() === "").length;
    const financeCount = primary.filter(
      ({ sector }) => sector.trim().toLocaleLowerCase("es-MX") === "finance",
    ).length;

    expect(blankCount).toBe(6);
    expect(financeCount).toBeLessThanOrEqual(4);
  });

  it("sanitizes invalid primarySize and alternateSize options", () => {
    const pool = Array.from({ length: 8 }, (_, index) =>
      candidate({
        id: `member-${index + 1}`,
        company: `Company ${index + 1}`,
        sector: `Sector ${index + 1}`,
      }),
    );
    const ranked = rankCandidates(pool);

    const negative = selectBalancedTable(ranked, {
      primarySize: -3,
      alternateSize: -1,
    });
    expect(negative.primary).toHaveLength(0);
    expect(negative.alternates).toHaveLength(0);

    const fractional = selectBalancedTable(ranked, {
      primarySize: 3.9,
      alternateSize: 2.2,
    });
    expect(fractional.primary).toHaveLength(3);
    expect(fractional.alternates).toHaveLength(2);

    const nonFinite = selectBalancedTable(ranked, {
      primarySize: Number.NaN,
      alternateSize: Number.POSITIVE_INFINITY,
    });
    expect(nonFinite.primary).toHaveLength(8);
    expect(nonFinite.alternates).toHaveLength(0);
    expect(
      nonFinite.warnings.some((warning) => warning.includes("pool too small")),
    ).toBe(true);
  });
});

describe("TABLE_SCORE", () => {
  it("exports transparent scoring constants", () => {
    expect(TABLE_SCORE).toEqual({
      notPreviousEvent: 30,
      neverInvited: 15,
      completionHigh: 10,
      completionLow: -10,
      recentCoPresence: -6,
      duplicateCompany: -40,
      sectorOverFour: -12,
    });
  });
});
