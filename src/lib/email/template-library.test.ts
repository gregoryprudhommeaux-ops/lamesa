import { describe, expect, it } from "vitest";
import {
  ARCHIVED_EMAIL_TEMPLATE_KEYS,
  DINNER_FUNNEL_TEMPLATE_KEYS,
  OUTSIDE_DINNER_TEMPLATE_KEYS,
  SYSTEM_EMAIL_TEMPLATE_KEYS,
  defaultLocaleContent,
} from "@/lib/email/template-defaults";

describe("email template library", () => {
  it("splits dinner and outside-dinner keys without the archived reminders", () => {
    const active = new Set<string>(SYSTEM_EMAIL_TEMPLATE_KEYS);
    expect(active.has("std_relance")).toBe(true);
    for (const key of ARCHIVED_EMAIL_TEMPLATE_KEYS) {
      expect(active.has(key)).toBe(false);
    }
    expect(
      [...DINNER_FUNNEL_TEMPLATE_KEYS, ...OUTSIDE_DINNER_TEMPLATE_KEYS].sort(),
    ).toEqual([...SYSTEM_EMAIL_TEMPLATE_KEYS].sort());
  });

  it("gives the STD follow-up a reply link in each locale", () => {
    for (const locale of ["fr", "es", "en"] as const) {
      const { subject, body } = defaultLocaleContent("std_relance", locale);
      expect(subject.length).toBeGreaterThan(8);
      expect(body).toContain("{{eventUrl}}");
      expect(body).toContain("{{eventTitle}}");
    }
  });
});
