/** Mexico IVA rate for LA MESA event pricing. */
export const EVENT_IVA_RATE = 0.16;
/** Service charge applied on top of the HT base (cost or sale) when included. */
export const EVENT_SERVICE_RATE = 0.15;

export type SeatPriceBreakdown = {
  /** HT base (cost or selling price before tax/service). */
  base: number;
  iva: number;
  service: number;
  ivaIncluded: boolean;
  serviceIncluded: boolean;
  /** base (+ IVA if included) (+ service if included). */
  total: number;
};

export type SeatPriceOptions = {
  /** When false, IVA is not added. Default true. */
  includeIva?: boolean;
  /** When false, service is not added. Default true. */
  includeService?: boolean;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Missing/undefined → included (legacy default). */
export function resolveIncludesFlag(value: boolean | null | undefined): boolean {
  return value !== false;
}

/** @deprecated Prefer resolveIncludesFlag */
export function resolveIncludesService(
  value: boolean | null | undefined,
): boolean {
  return resolveIncludesFlag(value);
}

/**
 * COST or prix de vente breakdown from negotiation flags.
 * Only adds IVA / service when the event marks them as included.
 */
export function computeSeatPriceBreakdown(
  baseMxn: number,
  options?: SeatPriceOptions,
): SeatPriceBreakdown {
  const base = Number.isFinite(baseMxn) && baseMxn > 0 ? roundMoney(baseMxn) : 0;
  const ivaIncluded = resolveIncludesFlag(options?.includeIva);
  const serviceIncluded = resolveIncludesFlag(options?.includeService);
  const iva = ivaIncluded ? roundMoney(base * EVENT_IVA_RATE) : 0;
  const service = serviceIncluded ? roundMoney(base * EVENT_SERVICE_RATE) : 0;
  const total = roundMoney(base + iva + service);
  return { base, iva, service, ivaIncluded, serviceIncluded, total };
}

/** Short FR formula label for dashboard / recap (only negotiated components). */
export function formatSeatPriceFormula(options?: SeatPriceOptions): string {
  const iva = resolveIncludesFlag(options?.includeIva);
  const service = resolveIncludesFlag(options?.includeService);
  const parts = ["HT"];
  if (iva) parts.push("IVA 16%");
  if (service) parts.push("svc 15%");
  if (parts.length === 1) return "HT (sans IVA ni service)";
  return `TTC · ${parts.join(" + ")}`;
}

/**
 * @deprecated Prefer computeSeatPriceBreakdown — kept for call sites using IVA naming.
 * `totalWithIva` is the negotiated TTC (may omit IVA and/or service).
 */
export function computeEventIva(
  priceBeforeTax: number,
  options?: SeatPriceOptions,
): {
  priceBeforeTax: number;
  iva: number;
  service: number;
  ivaIncluded: boolean;
  serviceIncluded: boolean;
  totalWithIva: number;
} {
  const b = computeSeatPriceBreakdown(priceBeforeTax, options);
  return {
    priceBeforeTax: b.base,
    iva: b.iva,
    service: b.service,
    ivaIncluded: b.ivaIncluded,
    serviceIncluded: b.serviceIncluded,
    totalWithIva: b.total,
  };
}

export type EventPricingFlags = {
  priceIncludesIva?: boolean | null;
  priceIncludesService?: boolean | null;
  costIncludesIva?: boolean | null;
  costIncludesService?: boolean | null;
};

export function salePriceOptions(flags: EventPricingFlags): SeatPriceOptions {
  return {
    includeIva: resolveIncludesFlag(flags.priceIncludesIva),
    includeService: resolveIncludesFlag(flags.priceIncludesService),
  };
}

export function costPriceOptions(flags: EventPricingFlags): SeatPriceOptions {
  return {
    includeIva: resolveIncludesFlag(flags.costIncludesIva),
    includeService: resolveIncludesFlag(flags.costIncludesService),
  };
}

/** Per-seat margin: sale TTC − cost TTC (0 if either base missing). */
export function computeSeatMarginMxn(input: {
  costMxn: number | null | undefined;
  priceMxn: number | null | undefined;
} & EventPricingFlags): number {
  const cost = computeSeatPriceBreakdown(
    typeof input.costMxn === "number" ? input.costMxn : 0,
    costPriceOptions(input),
  ).total;
  const sale = computeSeatPriceBreakdown(
    typeof input.priceMxn === "number" ? input.priceMxn : 0,
    salePriceOptions(input),
  ).total;
  if (cost <= 0 || sale <= 0) return 0;
  return roundMoney(sale - cost);
}

/**
 * Event P&L snapshot from seats.
 * - CA = paid seats × sale TTC (only negotiated IVA/service)
 * - Cost = (paid + complimentary) × cost TTC
 * - Complimentary seats add cost, zero revenue
 */
export function computeEventEconomics(input: {
  costMxn: number | null | undefined;
  priceMxn: number | null | undefined;
  paidSeatCount: number;
  complimentarySeatCount: number;
} & EventPricingFlags): {
  costPerSeat: SeatPriceBreakdown;
  salePerSeat: SeatPriceBreakdown;
  revenueMxn: number;
  costTotalMxn: number;
  marginMxn: number;
  paidSeatCount: number;
  complimentarySeatCount: number;
  saleFormula: string;
} {
  const costPerSeat = computeSeatPriceBreakdown(
    typeof input.costMxn === "number" ? input.costMxn : 0,
    costPriceOptions(input),
  );
  const saleOpts = salePriceOptions(input);
  const salePerSeat = computeSeatPriceBreakdown(
    typeof input.priceMxn === "number" ? input.priceMxn : 0,
    saleOpts,
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
    saleFormula: formatSeatPriceFormula(saleOpts),
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
