import { describe, expect, it } from "vitest";
import {
  buildDeclaredSubjectInterests,
  composeDinnerThemesForMatching,
  mergeSubjectInterests,
  setSubjectInterestValidation,
  validatedSubjectTitles,
} from "@/lib/dinner-subjects/interests";
import type { DinnerSubject, DinnerSubjectInterest } from "@/lib/types/events";

const catalog: DinnerSubject[] = [
  {
    id: "s1",
    title: "Scale SaaS B2B",
    periodMonth: "2026-10",
    city: "Guadalajara",
    status: "published",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "s2",
    title: "Private equity",
    periodMonth: "2026-08",
    city: "Guadalajara",
    status: "published",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("dinner-subjects/interests", () => {
  it("builds pending interests from catalog ids", () => {
    const rows = buildDeclaredSubjectInterests(["s2", "missing", "s2", "s1"], catalog);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.subjectId).toBe("s2");
    expect(rows[0]?.validation).toBe("pending");
    expect(rows[1]?.title).toBe("Scale SaaS B2B");
  });

  it("preserves admin validation when re-declaring same subject", () => {
    const previous: DinnerSubjectInterest[] = [
      {
        subjectId: "s1",
        title: "Scale SaaS B2B",
        declaredAt: "2026-01-01T00:00:00.000Z",
        validation: "validated",
        validatedAt: "2026-01-02T00:00:00.000Z",
      },
    ];
    const next = buildDeclaredSubjectInterests(["s1", "s2"], catalog);
    const merged = mergeSubjectInterests(previous, next);
    expect(merged.find((r) => r.subjectId === "s1")?.validation).toBe("validated");
    expect(merged.find((r) => r.subjectId === "s2")?.validation).toBe("pending");
  });

  it("validates / rejects a subject interest", () => {
    const base = buildDeclaredSubjectInterests(["s1"], catalog);
    const validated = setSubjectInterestValidation(base, "s1", "validated", "Profil fondateur SaaS");
    expect(validated?.[0]?.validation).toBe("validated");
    expect(validated?.[0]?.validationNote).toContain("SaaS");
    expect(setSubjectInterestValidation(base, "nope", "rejected")).toBeNull();
  });

  it("composes matching text from free text + validated titles only", () => {
    const interests: DinnerSubjectInterest[] = [
      {
        subjectId: "s1",
        title: "Scale SaaS B2B",
        declaredAt: "a",
        validation: "validated",
      },
      {
        subjectId: "s2",
        title: "Private equity",
        declaredAt: "a",
        validation: "pending",
      },
    ];
    expect(validatedSubjectTitles(interests)).toEqual(["Scale SaaS B2B"]);
    expect(composeDinnerThemesForMatching("Climate ops", interests)).toBe(
      "Climate ops · Scale SaaS B2B",
    );
  });
});
