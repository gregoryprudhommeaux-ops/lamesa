import { describe, expect, it } from "vitest";
import { prospectStatusFromInterest } from "./status-from-interest";

describe("prospectStatusFromInterest", () => {
  it("maps YES to won", () => {
    expect(
      prospectStatusFromInterest({ interestResponse: "yes" }),
    ).toBe("won");
  });

  it("maps not available to no_not_available", () => {
    expect(
      prospectStatusFromInterest({
        interestResponse: "no",
        declineReason: "not_available",
      }),
    ).toBe("no_not_available");
  });

  it("maps want_to_know_more to to_follow", () => {
    expect(
      prospectStatusFromInterest({
        interestResponse: "no",
        declineReason: "want_to_know_more",
      }),
    ).toBe("to_follow");
  });

  it("maps not interested reasons to no_not_interested", () => {
    expect(
      prospectStatusFromInterest({
        interestResponse: "no",
        declineReason: "not_interested_theme",
      }),
    ).toBe("no_not_interested");
  });

  it("maps OTHER to to_follow", () => {
    expect(
      prospectStatusFromInterest({ interestResponse: "other" }),
    ).toBe("to_follow");
  });

  it("does not overwrite do_not_contact", () => {
    expect(
      prospectStatusFromInterest({
        interestResponse: "yes",
        existingStatus: "do_not_contact",
      }),
    ).toBeUndefined();
  });
});
