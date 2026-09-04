import { describe, expect, it } from "vitest";
import { buildEventShareMetadata } from "@/lib/events/event-share-meta";

describe("buildEventShareMetadata", () => {
  it("prefers shareTitle and shareDescription", () => {
    const meta = buildEventShareMetadata(
      {
        id: "1",
        slug: "dirigeants-fr-2026-09-24",
        title: "Long admin title",
        startsAt: "2026-09-25T02:00:00.000Z",
        shareTitle: "LA MESA | 24 Sept | Dîner des Dirigeants et Entrepreneurs Français GDL",
        shareDescription:
          "Save the Date — dîner entre dirigeants et entrepreneurs français. Dîners privés à Guadalajara. Liste sur invitation.",
        responseMode: "interest",
      },
      "fr",
      "Dîners privés à Guadalajara. Liste sur invitation.",
    );
    expect(meta.title).toContain("24 Sept");
    expect(meta.title).toContain("Dirigeants");
    expect(meta.description).toContain("Save the Date");
    expect(meta.description).toContain("Dîners privés");
  });

  it("falls back to interest lead + site description", () => {
    const meta = buildEventShareMetadata(
      {
        id: "1",
        slug: "x",
        title: "LA MESA TEST",
        startsAt: "2026-09-25T02:00:00.000Z",
        responseMode: "interest",
      },
      "fr",
      "Dîners privés à Guadalajara. Liste sur invitation.",
    );
    expect(meta.title).toMatch(/^LA MESA \|/);
    expect(meta.description).toContain("Save the Date");
    expect(meta.description).toContain("Dîners privés");
  });
});
