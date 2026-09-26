import { describe, expect, it } from "vitest";
import {
  computeEventEconomics,
  computeEventIva,
  computeSeatMarginMxn,
  computeSeatPriceBreakdown,
  formatSeatPriceFormula,
} from "./pricing";

describe("computeSeatPriceBreakdown", () => {
  it("adds IVA 16% and service 15% on the HT base by default", () => {
    const b = computeSeatPriceBreakdown(1000);
    expect(b.base).toBe(1000);
    expect(b.iva).toBe(160);
    expect(b.service).toBe(150);
    expect(b.ivaIncluded).toBe(true);
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

  it("skips IVA when includeIva is false", () => {
    const b = computeSeatPriceBreakdown(1000, { includeIva: false, includeService: true });
    expect(b.iva).toBe(0);
    expect(b.service).toBe(150);
    expect(b.total).toBe(1150);
  });

  it("can be HT only when both flags are off", () => {
    const b = computeSeatPriceBreakdown(1000, { includeIva: false, includeService: false });
    expect(b.total).toBe(1000);
    expect(formatSeatPriceFormula({ includeIva: false, includeService: false })).toBe(
      "HT (sans IVA ni service)",
    );
  });

  it("keeps computeEventIva total aligned with negotiated TTC", () => {
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
    expect(econ.salePerSeat.total).toBe(2620);
    expect(econ.revenueMxn).toBe(26200);
    expect(econ.costTotalMxn).toBe(15720);
    expect(econ.marginMxn).toBe(10480);
    expect(econ.saleFormula).toBe("TTC · HT + IVA 16% + svc 15%");
    expect(computeSeatMarginMxn({ costMxn: 1000, priceMxn: 2000 })).toBe(1310);
  });

  it("does not invent IVA/service when negotiation excluded them", () => {
    const econ = computeEventEconomics({
      costMxn: 1000,
      priceMxn: 1300,
      paidSeatCount: 11,
      complimentarySeatCount: 0,
      priceIncludesIva: true,
      priceIncludesService: false,
      costIncludesIva: true,
      costIncludesService: false,
    });
    // sale = 1300 + 208 = 1508
    expect(econ.salePerSeat.total).toBe(1508);
    expect(econ.revenueMxn).toBe(16588);
    expect(econ.saleFormula).toBe("TTC · HT + IVA 16%");
    // cost = 1000 + 160 = 1160 × 11
    expect(econ.costPerSeat.total).toBe(1160);
    expect(econ.costTotalMxn).toBe(12760);
  });
});
