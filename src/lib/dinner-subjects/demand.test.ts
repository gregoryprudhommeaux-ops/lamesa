import { describe, expect, it } from "vitest";
import {
  aggregateSubjectDemand,
  listCommunityThemeSuggestions,
  listPendingSubjectValidations,
} from "@/lib/dinner-subjects/demand";
import type { DinnerSubject, WaitlistRegistration } from "@/lib/types/events";

const subjects: DinnerSubject[] = [
  {
    id: "s-saas",
    title: "Scale SaaS",
    periodMonth: "2026-10",
    city: "Guadalajara",
    status: "published",
    createdAt: "a",
    updatedAt: "a",
  },
  {
    id: "s-pe",
    title: "Private equity",
    periodMonth: "2026-08",
    city: "Guadalajara",
    status: "published",
    createdAt: "a",
    updatedAt: "a",
  },
];

function member(
  id: string,
  interests: WaitlistRegistration["dinnerSubjectInterests"],
): Pick<
  WaitlistRegistration,
  | "id"
  | "fullName"
  | "email"
  | "company"
  | "sector"
  | "position"
  | "dinnerSubjectInterests"
> {
  return {
    id,
    fullName: id,
    email: `${id}@example.com`,
    company: "Co",
    sector: "tech",
    position: "founder",
    dinnerSubjectInterests: interests,
  };
}

describe("dinner-subjects/demand", () => {
  it("aggregates declared / pending / validated / rejected per subject", () => {
    const rows = aggregateSubjectDemand(subjects, [
      member("a", [
        {
          subjectId: "s-saas",
          title: "Scale SaaS",
          declaredAt: "2026-01-01",
          validation: "validated",
        },
        {
          subjectId: "s-pe",
          title: "Private equity",
          declaredAt: "2026-01-01",
          validation: "pending",
        },
      ]),
      member("b", [
        {
          subjectId: "s-saas",
          title: "Scale SaaS",
          declaredAt: "2026-01-02",
          validation: "pending",
        },
      ]),
      member("c", [
        {
          subjectId: "s-pe",
          title: "Private equity",
          declaredAt: "2026-01-03",
          validation: "rejected",
        },
      ]),
    ]);

    const saas = rows.find((r) => r.subject.id === "s-saas")!;
    const pe = rows.find((r) => r.subject.id === "s-pe")!;
    expect(saas.counts).toEqual({ declared: 2, pending: 1, validated: 1, rejected: 0 });
    expect(pe.counts).toEqual({ declared: 2, pending: 1, validated: 0, rejected: 1 });
    // Validated demand sorts first
    expect(rows[0]?.subject.id).toBe("s-saas");
  });

  it("lists pending validations oldest first", () => {
    const pending = listPendingSubjectValidations([
      member("b", [
        {
          subjectId: "s-saas",
          title: "Scale SaaS",
          declaredAt: "2026-01-02T00:00:00.000Z",
          validation: "pending",
        },
      ]),
      member("a", [
        {
          subjectId: "s-pe",
          title: "Private equity",
          declaredAt: "2026-01-01T00:00:00.000Z",
          validation: "pending",
        },
        {
          subjectId: "s-saas",
          title: "Scale SaaS",
          declaredAt: "2026-01-03T00:00:00.000Z",
          validation: "validated",
        },
      ]),
    ]);
    expect(pending).toHaveLength(2);
    expect(pending[0]?.memberId).toBe("a");
    expect(pending[0]?.subjectId).toBe("s-pe");
    expect(pending[1]?.memberId).toBe("b");
  });

  it("lists community theme suggestions newest first, skips empty", () => {
    const rows = listCommunityThemeSuggestions(
      [
        {
          id: "old",
          fullName: "Ana",
          email: "ana@example.com",
          company: "Co A",
          dinnerThemesInterest: "  Succession familiale  ",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "empty",
          fullName: "Bob",
          email: "bob@example.com",
          company: "",
          dinnerThemesInterest: "   ",
          updatedAt: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "new",
          fullName: "Carla",
          email: "carla@example.com",
          company: "Co C",
          dinnerThemesInterest: "Scale SaaS LatAm",
          updatedAt: "2026-02-15T00:00:00.000Z",
        },
      ],
      40,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.memberId).toBe("new");
    expect(rows[0]?.text).toBe("Scale SaaS LatAm");
    expect(rows[1]?.memberId).toBe("old");
    expect(rows[1]?.text).toBe("Succession familiale");
  });
});
