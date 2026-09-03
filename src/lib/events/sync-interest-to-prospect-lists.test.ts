import { describe, expect, it } from "vitest";
import {
  applyInterestListMembership,
  interestProspectListNames,
} from "./interest-prospect-lists";

describe("interestProspectListNames", () => {
  it("builds stable OUI / NON-AUTRE names from slug", () => {
    expect(interestProspectListNames("dirigeants-fr-2026-09-24")).toEqual({
      yes: "STD dirigeants-fr-2026-09-24 — OUI",
      noOther: "STD dirigeants-fr-2026-09-24 — NON/AUTRE",
    });
  });
});

describe("applyInterestListMembership", () => {
  const lists = interestProspectListNames("dirigeants-fr-2026-09-24");

  it("puts YES on OUI and removes NON/AUTRE", () => {
    expect(
      applyInterestListMembership([lists.noOther, "MEMBRES INSCRITS"], lists, "yes"),
    ).toEqual(["MEMBRES INSCRITS", lists.yes]);
  });

  it("puts OTHER on NON/AUTRE and removes OUI", () => {
    expect(applyInterestListMembership([lists.yes], lists, "other")).toEqual([lists.noOther]);
  });
});
