import type { AdminEvent } from "@/lib/types/events";

/** Map a Firestore event doc to the public AdminEvent shape (client-safe). */
export function mapPublishedEventDoc(
  id: string,
  slug: string,
  data: Record<string, unknown>,
): AdminEvent {
  return {
    id,
    slug: String(data.slug ?? slug),
    title: String(data.title ?? ""),
    subtitle: data.subtitle ? String(data.subtitle) : undefined,
    organizerName: data.organizerName ? String(data.organizerName) : undefined,
    introText: data.introText ? String(data.introText) : undefined,
    calendarTitle: data.calendarTitle ? String(data.calendarTitle) : undefined,
    venueName: data.venueName ? String(data.venueName) : undefined,
    address: data.address ? String(data.address) : undefined,
    mapsUrl: data.mapsUrl ? String(data.mapsUrl) : undefined,
    startsAt: String(data.startsAt ?? ""),
    endsAt: data.endsAt ? String(data.endsAt) : undefined,
    capacity: typeof data.capacity === "number" ? data.capacity : undefined,
    priceMxn: typeof data.priceMxn === "number" ? data.priceMxn : undefined,
    accessIncludesWelcomeDrink: Boolean(data.accessIncludesWelcomeDrink),
    accessIncludesAmuseBouche: Boolean(data.accessIncludesAmuseBouche),
    menuIncluded: data.menuIncluded ? String(data.menuIncluded) : undefined,
    menuPriceMinMxn:
      typeof data.menuPriceMinMxn === "number" ? data.menuPriceMinMxn : undefined,
    menuPriceMaxMxn:
      typeof data.menuPriceMaxMxn === "number" ? data.menuPriceMaxMxn : undefined,
    menuIncludesDrinks:
      data.menuIncludesDrinks === true
        ? true
        : data.menuIncludesDrinks === false
          ? false
          : null,
    pricingMode:
      data.pricingMode === "all_inclusive" || data.pricingMode === "ticket_onsite"
        ? data.pricingMode
        : undefined,
    parking:
      data.parking === "secure_nearby" ||
      data.parking === "valet" ||
      data.parking === "on_site" ||
      data.parking === "unknown"
        ? data.parking
        : undefined,
    responseMode: data.responseMode === "interest" ? "interest" : "rsvp",
    interestDeadlineAt: data.interestDeadlineAt ? String(data.interestDeadlineAt) : null,
    allInPriceMinMxn:
      typeof data.allInPriceMinMxn === "number" ? data.allInPriceMinMxn : null,
    allInPriceMaxMxn:
      typeof data.allInPriceMaxMxn === "number" ? data.allInPriceMaxMxn : null,
    shareTitle: data.shareTitle ? String(data.shareTitle) : null,
    shareDescription: data.shareDescription ? String(data.shareDescription) : null,
    status: "published",
  };
}
