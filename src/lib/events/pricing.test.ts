import { describe, expect, it } from "vitest";
import {
  computeEventEconomics,
  computeEventIva,
  computeSeatMarginMxn,
  computeSeatPriceBreakdown,
} from "./pricing";

describe("computeSeatPriceBreakdown", () => {
  it("adds IVA 16% and service 15% on the HT base by default", () => {
    const b = computeSeatPriceBreakdown(1000);
    expect(b.base).toBe(1000);
    expect(b.iva).toBe(160);
    expect(b.service).toBe(150);
    expect(b.serviceIncluded).toBe(true);
    expect(b.total).toBe(1310);
  });

  it("skips service when includeService is false", () => {
    const b = computeSeatPriceBreakdown(1000, { includeService: false });
    expect(b.iva).toBe(160);
    expect(b.service).toBe(0);
    expect(b.serviceIncluded).toBe(false);
    expect(b.total).toBe(1160);
  });

  it("keeps computeEventIva total aligned with full TTC", () => {
    const legacy = computeEventIva(1000);
    expect(legacy.totalWithIva).toBe(1310);
    expect(legacy.service).toBe(150);
    expect(computeEventIva(1000, { includeService: false }).totalWithIva).toBe(1160);
  });
});

describe("computeEventEconomics", () => {
  it("counts CA only on paid seats; cost on paid + complimentary", () => {
    const econ = computeEventEconomics({
      costMxn: 1000,
      priceMxn: 2000,
      paidSeatCount: 10,
      complimentarySeatCount: 2,
    });
    // sale TTC = 2000 * 1.31 = 2620 → 10 * 2620
    expect(econ.salePerSeat.total).toBe(2620);
    expect(econ.revenueMxn).toBe(26200);
    // cost TTC = 1310 × 12
    expect(econ.costTotalMxn).toBe(15720);
    expect(econ.marginMxn).toBe(10480);
    expect(computeSeatMarginMxn({ costMxn: 1000, priceMxn: 2000 })).toBe(1310);
  });

  it("honors independent service flags on sale vs cost", () => {
    const econ = computeEventEconomics({
      costMxn: 1000,
      priceMxn: 1000,
      paidSeatCount: 1,
      complimentarySeatCount: 0,
      priceIncludesService: true,
      costIncludesService: false,
    });
    expect(econ.salePerSeat.total).toBe(1310);
    expect(econ.costPerSeat.total).toBe(1160);
    expect(econ.marginMxn).toBe(150);
  });
});
