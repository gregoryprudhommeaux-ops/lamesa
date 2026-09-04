import { describe, expect, it } from "vitest";
import { eventSlugFromTitleAndDate, slugify } from "./utils";

describe("slugify", () => {
  it("normalizes accents and spaces", () => {
    expect(slugify("Dirigeants Français")).toBe("dirigeants-francais");
  });
});

describe("eventSlugFromTitleAndDate", () => {
  it("appends Mexico City calendar date from UTC start", () => {
    // Wed 24 Sep 2026 20:00 Mexico ≈ 2026-09-25T02:00:00.000Z
    expect(
      eventSlugFromTitleAndDate(
        "Dirigeants FR",
        "2026-09-25T02:00:00.000Z",
      ),
    ).toBe("dirigeants-fr-2026-09-24");
  });

  it("falls back to title slug when date invalid", () => {
    expect(eventSlugFromTitleAndDate("Hello Night", "not-a-date")).toBe("hello-night");
  });
});
