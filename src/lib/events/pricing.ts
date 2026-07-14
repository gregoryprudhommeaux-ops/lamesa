/** Mexico IVA rate for LA MESA event pricing. */
export const EVENT_IVA_RATE = 0.16;

export function computeEventIva(priceBeforeTax: number): {
  priceBeforeTax: number;
  iva: number;
  totalWithIva: number;
} {
  const base = Number.isFinite(priceBeforeTax) && priceBeforeTax > 0 ? priceBeforeTax : 0;
  const iva = Math.round(base * EVENT_IVA_RATE * 100) / 100;
  const totalWithIva = Math.round((base + iva) * 100) / 100;
  return {
    priceBeforeTax: Math.round(base * 100) / 100,
    iva,
    totalWithIva,
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
