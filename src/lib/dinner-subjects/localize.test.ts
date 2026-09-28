import { describe, expect, it } from "vitest";
import {
  isDinnerSubjectLocale,
  localizeDinnerSubject,
  localizeDinnerSubjectList,
  resolveSubjectSourceLocale,
} from "@/lib/dinner-subjects/localize";
import type { DinnerSubject } from "@/lib/types/events";

function subject(partial: Partial<DinnerSubject> & Pick<DinnerSubject, "title">): DinnerSubject {
  return {
    id: "s1",
    periodMonth: "2026-10",
    city: "Mexico City",
    status: "published",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sourceLocale: "fr",
    ...partial,
  };
}

describe("dinner-subjects/localize", () => {
  it("accepts fr/en/es only", () => {
    expect(isDinnerSubjectLocale("fr")).toBe(true);
    expect(isDinnerSubjectLocale("en")).toBe(true);
    expect(isDinnerSubjectLocale("es")).toBe(true);
    expect(isDinnerSubjectLocale("de")).toBe(false);
  });

  it("defaults source locale to fr", () => {
    expect(resolveSubjectSourceLocale({})).toBe("fr");
    expect(resolveSubjectSourceLocale({ sourceLocale: "en" })).toBe("en");
  });

  it("picks translated title/summary for locale", () => {
    const row = subject({
      title: "Fondateurs & pairs",
      summary: "Décisions entre pairs",
      titleI18n: {
        fr: "Fondateurs & pairs",
        en: "Founders & peers",
        es: "Fundadores y pares",
      },
      summaryI18n: {
        fr: "Décisions entre pairs",
        en: "Peer decisions",
        es: "Decisiones entre pares",
      },
    });
    expect(localizeDinnerSubject(row, "en").title).toBe("Founders & peers");
    expect(localizeDinnerSubject(row, "en").summary).toBe("Peer decisions");
    expect(localizeDinnerSubject(row, "es").title).toBe("Fundadores y pares");
    expect(localizeDinnerSubject(row, "fr").title).toBe("Fondateurs & pairs");
  });

  it("falls back to source title when locale missing", () => {
    const row = subject({
      title: "Impact climate",
      summary: "Transition",
      titleI18n: { fr: "Impact climate" },
    });
    expect(localizeDinnerSubject(row, "en").title).toBe("Impact climate");
    expect(localizeDinnerSubject(row, "en").summary).toBe("Transition");
  });

  it("localizes lists", () => {
    const rows = [
      subject({
        id: "a",
        title: "A",
        titleI18n: { fr: "A", en: "A-en" },
      }),
    ];
    expect(localizeDinnerSubjectList(rows, "en")[0]?.title).toBe("A-en");
  });
});
