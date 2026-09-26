/** Mexico IVA rate for LA MESA event pricing. */
export const EVENT_IVA_RATE = 0.16;
/** Service charge applied on top of the HT base (cost or sale) when included. */
export const EVENT_SERVICE_RATE = 0.15;

export type SeatPriceBreakdown = {
  /** HT base (cost or selling price before tax/service). */
  base: number;
  iva: number;
  service: number;
  /** Whether service was applied. */
  serviceIncluded: boolean;
  /** base + IVA (+ service if included). */
  total: number;
};

export type SeatPriceOptions = {
  /** When false, TTC = HT + IVA only. Default true. */
  includeService?: boolean;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Missing/undefined → service included (legacy default). */
export function resolveIncludesService(
  value: boolean | null | undefined,
): boolean {
  return value !== false;
}

/**
 * COST or prix de vente breakdown:
 * base HT + IVA 16% + optional service 15% (both computed on the HT base).
 */
export function computeSeatPriceBreakdown(
  baseMxn: number,
  options?: SeatPriceOptions,
): SeatPriceBreakdown {
  const base = Number.isFinite(baseMxn) && baseMxn > 0 ? roundMoney(baseMxn) : 0;
  const serviceIncluded = resolveIncludesService(options?.includeService);
  const iva = roundMoney(base * EVENT_IVA_RATE);
  const service = serviceIncluded ? roundMoney(base * EVENT_SERVICE_RATE) : 0;
  const total = roundMoney(base + iva + service);
  return { base, iva, service, serviceIncluded, total };
}

/**
 * @deprecated Prefer computeSeatPriceBreakdown — kept for call sites using IVA naming.
 * `totalWithIva` is TTC = HT + IVA (+ service when included).
 */
export function computeEventIva(
  priceBeforeTax: number,
  options?: SeatPriceOptions,
): {
  priceBeforeTax: number;
  iva: number;
  service: number;
  serviceIncluded: boolean;
  totalWithIva: number;
} {
  const b = computeSeatPriceBreakdown(priceBeforeTax, options);
  return {
    priceBeforeTax: b.base,
    iva: b.iva,
    service: b.service,
    serviceIncluded: b.serviceIncluded,
    totalWithIva: b.total,
  };
}

/** Per-seat margin: sale TTC − cost TTC (0 if either base missing). */
export function computeSeatMarginMxn(input: {
  costMxn: number | null | undefined;
  priceMxn: number | null | undefined;
  priceIncludesService?: boolean | null;
  costIncludesService?: boolean | null;
}): number {
  const cost = computeSeatPriceBreakdown(
    typeof input.costMxn === "number" ? input.costMxn : 0,
    { includeService: resolveIncludesService(input.costIncludesService) },
  ).total;
  const sale = computeSeatPriceBreakdown(
    typeof input.priceMxn === "number" ? input.priceMxn : 0,
    { includeService: resolveIncludesService(input.priceIncludesService) },
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
  priceIncludesService?: boolean | null;
  costIncludesService?: boolean | null;
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
    { includeService: resolveIncludesService(input.costIncludesService) },
  );
  const salePerSeat = computeSeatPriceBreakdown(
    typeof input.priceMxn === "number" ? input.priceMxn : 0,
    { includeService: resolveIncludesService(input.priceIncludesService) },
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
