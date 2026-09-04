import { describe, expect, it } from "vitest";
import {
  buildInterestSummary,
  interestCalendarDescription,
  interestCalendarTitle,
} from "./send-interest-ack";
import type { AdminEvent } from "@/lib/types/events";

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

describe("interest calendar helpers", () => {
  const baseEvent = {
    id: "e1",
    slug: "dirigeants-fr-2026-09-24",
    title: "LA MESA DES DIRIGEANTS ET ENTREPRENEURS FRANÇAIS",
    startsAt: "2026-09-25T02:00:00.000Z",
  } as AdminEvent;

  it("prefers calendarTitle when set", () => {
    expect(
      interestCalendarTitle({
        ...baseEvent,
        calendarTitle: "LA MESA | Dîner des Dirigeants et Entrepreneurs Français (GDL)",
      }),
    ).toBe("LA MESA | Dîner des Dirigeants et Entrepreneurs Français (GDL)");
  });

  it("uses introText as calendar description", () => {
    const desc = interestCalendarDescription({
      ...baseEvent,
      introText: "Contexte <bold>dîner</bold> pour rappel.",
    });
    expect(desc).toBe("Contexte dîner pour rappel.");
  });
});
