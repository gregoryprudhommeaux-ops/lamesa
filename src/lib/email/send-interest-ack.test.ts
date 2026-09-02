import { describe, expect, it } from "vitest";
import { buildInterestSummary } from "./send-interest-ack";

describe("buildInterestSummary", () => {
  it("formats YES with expectations in FR", () => {
    const text = buildInterestSummary({
      locale: "fr",
      interestResponse: "yes",
      expectations: "Échanger entre fondateurs",
    });
    expect(text).toContain("Oui, intéressé(e)");
    expect(text).toContain("Attentes : Échanger entre fondateurs");
  });

  it("formats NO with decline reason", () => {
    const text = buildInterestSummary({
      locale: "fr",
      interestResponse: "no",
      declineReason: "not_available",
    });
    expect(text).toContain("Non, je ne participe pas");
    expect(text).toContain("Pas disponible");
  });
});
