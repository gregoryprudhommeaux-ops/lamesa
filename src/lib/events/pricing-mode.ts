import type { AdminEvent } from "@/lib/types/events";

export type EventPricingMode = "ticket_onsite" | "all_inclusive";

/** Resolve pricing mode with legacy fallback (all-in range ⇒ all_inclusive). */
export function resolveEventPricingMode(
  event: Pick<AdminEvent, "pricingMode" | "allInPriceMinMxn" | "allInPriceMaxMxn">,
): EventPricingMode {
  if (event.pricingMode === "all_inclusive" || event.pricingMode === "ticket_onsite") {
    return event.pricingMode;
  }
  const hasAllIn =
    (typeof event.allInPriceMinMxn === "number" && event.allInPriceMinMxn > 0) ||
    (typeof event.allInPriceMaxMxn === "number" && event.allInPriceMaxMxn > 0);
  return hasAllIn ? "all_inclusive" : "ticket_onsite";
}
