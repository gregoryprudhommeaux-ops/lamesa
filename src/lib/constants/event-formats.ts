/**
 * LA MESA gathering formats — stored as stable codes; labels are localized.
 */
export const EVENT_FORMATS = [
  "breakfast",
  "coffee",
  "aperitif",
  "dinner",
] as const;

export type EventFormat = (typeof EVENT_FORMATS)[number];

export const DEFAULT_EVENT_FORMAT: EventFormat = "dinner";

export type FormatLocale = "fr" | "es" | "en";

/** Short noun labels for {{format}} and admin UI. */
export const EVENT_FORMAT_LABELS: Record<FormatLocale, Record<EventFormat, string>> = {
  fr: {
    breakfast: "Petit-déjeuner",
    coffee: "Café",
    aperitif: "Apéro",
    dinner: "Dîner",
  },
  es: {
    breakfast: "Desayuno",
    coffee: "Café",
    /** Common MX networking framing for evening drinks */
    aperitif: "Afterwork",
    dinner: "Cena",
  },
  en: {
    breakfast: "Breakfast",
    coffee: "Coffee",
    aperitif: "Drinks",
    dinner: "Dinner",
  },
};

export function isEventFormat(value: unknown): value is EventFormat {
  return typeof value === "string" && (EVENT_FORMATS as readonly string[]).includes(value);
}

export function resolveEventFormat(value: unknown): EventFormat {
  return isEventFormat(value) ? value : DEFAULT_EVENT_FORMAT;
}

export function labelEventFormat(
  format: EventFormat | null | undefined,
  locale: FormatLocale = "fr",
): string {
  const key = resolveEventFormat(format);
  return EVENT_FORMAT_LABELS[locale][key];
}

/** Suggested local start/end times when seeding a new event from a draft. */
export function defaultTimesForFormat(format: EventFormat): {
  startTime: string;
  endTime: string;
} {
  switch (format) {
    case "breakfast":
      return { startTime: "08:30", endTime: "10:00" };
    case "coffee":
      return { startTime: "10:30", endTime: "12:00" };
    case "aperitif":
      return { startTime: "18:30", endTime: "20:30" };
    case "dinner":
    default:
      return { startTime: "19:30", endTime: "22:30" };
  }
}
