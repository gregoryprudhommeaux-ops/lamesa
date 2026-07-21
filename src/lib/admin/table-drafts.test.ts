import { describe, expect, it } from "vitest";
import {
  listRecentTableDraftSummaries,
  normalizeTableDraft,
  tableDraftCreateSchema,
  tableDraftPatchSchema,
  timestampValue,
  validateMergedTableDraft,
} from "./table-drafts";

function member(id: string) {
  return {
    id,
    fullName: `Member ${id}`,
    email: `${id}@example.com`,
    company: "LA MESA",
    sector: "Technology",
    position: "Founder",
    city: "Mexico City",
  };
}

function validDraftInput() {
  return {
    title: "Builders and operators",
    city: "Guadalajara",
    format: "dinner" as const,
    themeAngle: "Scaling durable companies",
    rationale: "A balanced group of builders with complementary operating experience.",
    commonalities: ["B2B"],
    complementarities: ["Product and sales"],
    warnings: [],
    primary: Array.from({ length: 15 }, (_, index) => member(`p-${index}`)),
    alternates: Array.from({ length: 5 }, (_, index) => member(`a-${index}`)),
  };
}

describe("listRecentTableDraftSummaries", () => {
  it("excludes archived drafts and returns newest active summaries", () => {
    const docs = [
      ...Array.from({ length: 25 }, (_, index) => ({
        id: `archived-${index}`,
        data: () => ({
          ...validDraftInput(),
          status: "archived",
          updatedAt: `2026-07-17T${String(24 - index).padStart(2, "0")}:00:00.000Z`,
        }),
      })),
      {
        id: "active-older",
        data: () => ({
          ...validDraftInput(),
          title: "Older active table",
          city: "Monterrey",
          status: "draft",
          updatedAt: "2026-07-10T12:00:00.000Z",
        }),
      },
      {
        id: "active-newest",
        data: () => ({
          ...validDraftInput(),
          title: "Newest active table",
          city: "Guadalajara",
          status: "draft",
          updatedAt: "2026-07-11T12:00:00.000Z",
        }),
      },
    ];

    expect(listRecentTableDraftSummaries(docs, 3)).toEqual([
      {
        id: "active-newest",
        title: "Newest active table",
        city: "Guadalajara",
        format: "dinner",
        primaryCount: 15,
        alternateCount: 5,
        updatedAt: "2026-07-11T12:00:00.000Z",
      },
      {
        id: "active-older",
        title: "Older active table",
        city: "Monterrey",
        format: "dinner",
        primaryCount: 15,
        alternateCount: 5,
        updatedAt: "2026-07-10T12:00:00.000Z",
      },
    ]);
  });
});

describe("tableDraftCreateSchema", () => {
  it("accepts 15 unique primary and up to 5 unique alternates", () => {
    expect(tableDraftCreateSchema.safeParse(validDraftInput()).success).toBe(true);
  });

  it("rejects a member present in both primary and alternates", () => {
    const input = validDraftInput();
    input.alternates[0] = input.primary[0];

    expect(tableDraftCreateSchema.safeParse(input).success).toBe(false);
  });

  it("rejects duplicate member ids", () => {
    const input = validDraftInput();
    input.primary[1] = input.primary[0];

    expect(tableDraftCreateSchema.safeParse(input).success).toBe(false);
  });
});

describe("tableDraftPatchSchema", () => {
  it("accepts a top-level city update", () => {
    expect(tableDraftPatchSchema.safeParse({ city: "Monterrey" }).success).toBe(true);
  });

  it("allows used status without linkedEventId in the patch body", () => {
    expect(tableDraftPatchSchema.safeParse({ status: "used" }).success).toBe(true);
  });

  it("rejects unknown fields", () => {
    expect(
      tableDraftPatchSchema.safeParse({ title: "Valid title here", unexpected: true }).success,
    ).toBe(false);
  });

  it("accepts humanValidatedAt ISO or null", () => {
    expect(
      tableDraftPatchSchema.safeParse({ humanValidatedAt: "2026-07-18T16:00:00.000Z" }).success,
    ).toBe(true);
    expect(tableDraftPatchSchema.safeParse({ humanValidatedAt: null }).success).toBe(true);
  });
});

describe("validateMergedTableDraft human validation", () => {
  it("clears humanValidatedAt when seats change unless explicitly set", () => {
    const current = normalizeTableDraft("draft-1", {
      ...validDraftInput(),
      status: "draft",
      humanValidatedAt: "2026-07-18T12:00:00.000Z",
      createdByUid: "admin-1",
      createdByEmail: "admin@example.com",
    });

    const cleared = validateMergedTableDraft(current, {
      primary: validDraftInput().primary,
    });
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.merged.humanValidatedAt).toBeUndefined();

    const kept = validateMergedTableDraft(current, {
      primary: validDraftInput().primary,
      humanValidatedAt: "2026-07-18T16:00:00.000Z",
    });
    expect(kept.ok).toBe(true);
    if (kept.ok) expect(kept.merged.humanValidatedAt).toBe("2026-07-18T16:00:00.000Z");
  });
});

describe("validateMergedTableDraft", () => {
  it("accepts used status when merged linkedEventId exists", () => {
    const current = normalizeTableDraft("draft-1", {
      ...validDraftInput(),
      status: "draft",
      linkedEventId: "event-1",
      createdByUid: "admin-1",
      createdByEmail: "admin@example.com",
    });

    expect(validateMergedTableDraft(current, { status: "used" }).ok).toBe(true);
  });

  it("rejects used status when merged linkedEventId is missing", () => {
    const current = normalizeTableDraft("draft-1", {
      ...validDraftInput(),
      status: "draft",
      createdByUid: "admin-1",
      createdByEmail: "admin@example.com",
    });

    expect(validateMergedTableDraft(current, { status: "used" }).ok).toBe(false);
  });

  it("rejects non-archive mutations when seats are incomplete", () => {
    const current = normalizeTableDraft("draft-1", {
      title: "Builders and operators",
      themeAngle: "Scaling durable companies",
      rationale: "A balanced group of builders with complementary operating experience.",
      primary: [member("only-one")],
      status: "draft",
      createdByUid: "admin-1",
      createdByEmail: "admin@example.com",
    });

    expect(validateMergedTableDraft(current, { title: "Updated table title" }).ok).toBe(false);
  });

  it("allows archive without enforcing seat completeness", () => {
    const current = normalizeTableDraft("draft-1", {
      title: "x",
      primary: [member("only-one")],
      status: "draft",
      createdByUid: "admin-1",
      createdByEmail: "admin@example.com",
    });

    expect(validateMergedTableDraft(current, { status: "archived" }).ok).toBe(true);
  });

  it("rejects edits to an already archived draft when seats are incomplete", () => {
    const current = normalizeTableDraft("draft-1", {
      title: "x",
      primary: [member("only-one")],
      status: "archived",
      createdByUid: "admin-1",
      createdByEmail: "admin@example.com",
    });

    expect(validateMergedTableDraft(current, { title: "Updated table title" }).ok).toBe(false);
  });
});

describe("timestampValue", () => {
  it("returns undefined for invalid timestamps without throwing", () => {
    expect(timestampValue(new Date("invalid"))).toBeUndefined();
    expect(timestampValue({ toDate: () => new Date("invalid") })).toBeUndefined();
    expect(timestampValue({ toDate: () => {
      throw new Error("boom");
    } })).toBeUndefined();
    expect(timestampValue("not-a-date-but-string")).toBeUndefined();
    expect(timestampValue({ toDate: () => "2026-07-17T12:00:00.000Z" })).toBeUndefined();
  });

  it("normalizes parseable date-like strings for chronological sorting", () => {
    expect(timestampValue("July 16, 2026 12:00:00 UTC")).toBe("2026-07-16T12:00:00.000Z");
  });
});

describe("normalizeTableDraft", () => {
  it("normalizes Firestore data with stable defaults", () => {
    const timestamp = { toDate: () => new Date("2026-07-17T12:00:00.000Z") };

    expect(
      normalizeTableDraft("draft-1", {
        title: 42,
        city: "Guadalajara",
        status: "used",
        primary: [member("shared"), member("shared"), null],
        alternates: [member("shared"), member("alternate"), { id: "" }],
        createdAt: timestamp,
      }),
    ).toEqual({
      id: "draft-1",
      title: "",
      city: "Guadalajara",
      format: "dinner",
      themeAngle: "",
      rationale: "",
      commonalities: [],
      complementarities: [],
      warnings: [],
      primary: [member("shared")],
      alternates: [member("alternate")],
      status: "draft",
      linkedEventId: undefined,
      humanValidatedAt: undefined,
      createdAt: "2026-07-17T12:00:00.000Z",
      updatedAt: undefined,
      createdByUid: "",
      createdByEmail: "",
    });
  });

  it("normalizes legacy missing status and Invalid Date timestamps", () => {
    expect(
      normalizeTableDraft("legacy", {
        ...validDraftInput(),
        updatedAt: new Date("nope"),
      }),
    ).toEqual(
      expect.objectContaining({
        id: "legacy",
        status: "draft",
        updatedAt: undefined,
      }),
    );
  });
});
