import { describe, expect, it } from "vitest";
import { eventSlugFromTitleAndDate, fmtDateTime, slugify } from "./utils";

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

describe("fmtDateTime", () => {
  it("shows Mexico City local date for dirigeants dinner UTC start", () => {
    // 2026-09-25T02:00Z = 24 sept 20:00 America/Mexico_City — not "25 sept"
    const fr = fmtDateTime("2026-09-25T02:00:00.000Z", "fr");
    expect(fr).toMatch(/24/);
    expect(fr).not.toMatch(/25/);
    expect(fr.toLowerCase()).toMatch(/sept/);
  });
});
