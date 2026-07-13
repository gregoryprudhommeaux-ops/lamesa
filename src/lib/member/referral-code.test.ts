import { describe, expect, it } from "vitest";
import {
  buildReferralCode,
  normalizeReferralCode,
  isValidReferralCodeFormat,
} from "./referral-code";

describe("referral-code", () => {
  it("builds PREFIX-SUFF from first name", () => {
    const code = buildReferralCode("Grégory Prudhommeaux", () => "7K");
    expect(code).toBe("GREG-7K");
  });

  it("pads single-letter first names to two letters", () => {
    expect(buildReferralCode("A Smith", () => "7K")).toBe("AA-7K");
    expect(isValidReferralCodeFormat("AA-7K")).toBe(true);
  });

  it("normalizes and validates", () => {
    expect(normalizeReferralCode(" greg-7k ")).toBe("GREG-7K");
    expect(isValidReferralCodeFormat("GREG-7K")).toBe(true);
    expect(isValidReferralCodeFormat("bad")).toBe(false);
  });
});
