import { describe, expect, it } from "vitest";
import { resolveEventPricingMode } from "./pricing-mode";

describe("resolveEventPricingMode", () => {
  it("prefers explicit pricingMode", () => {
    expect(resolveEventPricingMode({ pricingMode: "all_inclusive" })).toBe("all_inclusive");
    expect(resolveEventPricingMode({ pricingMode: "ticket_onsite", allInPriceMinMxn: 900 })).toBe(
      "ticket_onsite",
    );
  });

  it("falls back to all_inclusive when legacy all-in range is set", () => {
    expect(resolveEventPricingMode({ allInPriceMinMxn: 800, allInPriceMaxMxn: 1000 })).toBe(
      "all_inclusive",
    );
  });

  it("defaults to ticket_onsite", () => {
    expect(resolveEventPricingMode({})).toBe("ticket_onsite");
  });
});
