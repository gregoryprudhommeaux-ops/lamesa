import { describe, expect, it } from "vitest";
import {
  applyProspectStatusToStdLists,
  extractStdEventSlugsFromLists,
  interestProspectListNames,
} from "./interest-prospect-lists";

describe("applyProspectStatusToStdLists", () => {
  const slug = "dirigeants-fr-2026-09-24";
  const pair = interestProspectListNames(slug);
  const short = `STD ${slug} — SHORTLIST FR`;

  it("extracts STD slugs from playlist names", () => {
    expect(extractStdEventSlugsFromLists([short, pair.yes, "A contacter"])).toEqual([
      slug,
    ]);
  });

  it("moves OUI → NON when status becomes no_not_available", () => {
    const next = applyProspectStatusToStdLists(
      ["A contacter", short, pair.yes],
      "no_not_available",
    );
    expect(next).toContain(pair.noOther);
    expect(next).toContain(short);
    expect(next).not.toContain(pair.yes);
  });

  it("moves to OUI when status becomes won", () => {
    const next = applyProspectStatusToStdLists([short, pair.noOther], "won");
    expect(next).toContain(pair.yes);
    expect(next).not.toContain(pair.noOther);
  });
});
