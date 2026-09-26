/** Mexico IVA rate for LA MESA event pricing. */
export const EVENT_IVA_RATE = 0.16;
/** Service charge applied on top of the HT base (cost or sale). */
export const EVENT_SERVICE_RATE = 0.15;

export type SeatPriceBreakdown = {
  /** HT base (cost or selling price before tax/service). */
  base: number;
  iva: number;
  service: number;
  /** base + IVA + service. */
  total: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * COST or prix de vente breakdown:
 * base HT + IVA 16% + service 15% (both computed on the HT base).
 */
export function computeSeatPriceBreakdown(baseMxn: number): SeatPriceBreakdown {
  const base = Number.isFinite(baseMxn) && baseMxn > 0 ? roundMoney(baseMxn) : 0;
  const iva = roundMoney(base * EVENT_IVA_RATE);
  const service = roundMoney(base * EVENT_SERVICE_RATE);
  const total = roundMoney(base + iva + service);
  return { base, iva, service, total };
}

/**
 * @deprecated Prefer computeSeatPriceBreakdown — kept for call sites using IVA naming.
 * `totalWithIva` is actually TTC = HT + IVA + service.
 */
export function computeEventIva(priceBeforeTax: number): {
  priceBeforeTax: number;
  iva: number;
  service: number;
  totalWithIva: number;
} {
  const b = computeSeatPriceBreakdown(priceBeforeTax);
  return {
    priceBeforeTax: b.base,
    iva: b.iva,
    service: b.service,
    totalWithIva: b.total,
  };
}

/** Per-seat margin: sale TTC − cost TTC (0 if either base missing). */
export function computeSeatMarginMxn(input: {
  costMxn: number | null | undefined;
  priceMxn: number | null | undefined;
}): number {
  const cost = computeSeatPriceBreakdown(
    typeof input.costMxn === "number" ? input.costMxn : 0,
  ).total;
  const sale = computeSeatPriceBreakdown(
    typeof input.priceMxn === "number" ? input.priceMxn : 0,
  ).total;
  if (cost <= 0 || sale <= 0) return 0;
  return roundMoney(sale - cost);
}

/**
 * Event P&L snapshot from seats.
 * - CA = paid seats × sale TTC
 * - Cost = (paid + complimentary) × cost TTC
 * - Complimentary seats add cost, zero revenue
 */
export function computeEventEconomics(input: {
  costMxn: number | null | undefined;
  priceMxn: number | null | undefined;
  paidSeatCount: number;
  complimentarySeatCount: number;
}): {
  costPerSeat: SeatPriceBreakdown;
  salePerSeat: SeatPriceBreakdown;
  revenueMxn: number;
  costTotalMxn: number;
  marginMxn: number;
  paidSeatCount: number;
  complimentarySeatCount: number;
} {
  const costPerSeat = computeSeatPriceBreakdown(
    typeof input.costMxn === "number" ? input.costMxn : 0,
  );
  const salePerSeat = computeSeatPriceBreakdown(
    typeof input.priceMxn === "number" ? input.priceMxn : 0,
  );
  const paid = Math.max(0, Math.floor(input.paidSeatCount));
  const comps = Math.max(0, Math.floor(input.complimentarySeatCount));
  const revenueMxn = roundMoney(salePerSeat.total * paid);
  const costTotalMxn = roundMoney(costPerSeat.total * (paid + comps));
  return {
    costPerSeat,
    salePerSeat,
    revenueMxn,
    costTotalMxn,
    marginMxn: roundMoney(revenueMxn - costTotalMxn),
    paidSeatCount: paid,
    complimentarySeatCount: comps,
  };
}

export function formatMxn(amount: number, locale: "fr" | "es" | "en" = "es"): string {
  try {
    return new Intl.NumberFormat(locale === "en" ? "en-MX" : locale === "fr" ? "fr-MX" : "es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)} MXN`;
  }
}
