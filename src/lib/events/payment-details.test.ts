import { describe, expect, it } from "vitest";
import {
  cancellationPolicyBlock,
  formatPaymentDeadlineDate,
  paymentDeadlineBlock,
} from "@/lib/events/payment-details";
import { defaultLocaleContent } from "@/lib/email/template-defaults";

describe("cancellationPolicyBlock", () => {
  it("mentions 48h in all locales", () => {
    for (const locale of ["es", "fr", "en"] as const) {
      const block = cancellationPolicyBlock(locale);
      expect(block).toMatch(/48/);
      expect(block.length).toBeGreaterThan(40);
    }
  });
});

describe("paymentDeadlineBlock", () => {
  it("uses the event deadline date when provided", () => {
    const iso = "2026-09-25T05:59:00.000Z"; // 24 sept Mexico City
    const fr = paymentDeadlineBlock("fr", iso);
    expect(fr).toContain(formatPaymentDeadlineDate(iso, "fr"));
    expect(fr).not.toMatch(/3 jours/);
  });

  it("falls back without a fixed 3-day window", () => {
    for (const locale of ["es", "fr", "en"] as const) {
      const block = paymentDeadlineBlock(locale);
      expect(block).not.toMatch(/3 (días|jours|days)/i);
      expect(block.length).toBeGreaterThan(40);
    }
  });
});

describe("P0 email defaults", () => {
  it("puts cancellation on invite and confirmation", () => {
    for (const key of ["calendar_invite", "participation_confirmed"] as const) {
      for (const locale of ["es", "fr", "en"] as const) {
        const { body } = defaultLocaleContent(key, locale);
        expect(body).toContain(cancellationPolicyBlock(locale));
      }
    }
  });

  it("keeps payment deadline placeholder on invite", () => {
    for (const locale of ["es", "fr", "en"] as const) {
      const { body } = defaultLocaleContent("calendar_invite", locale);
      expect(body).toContain("{{paymentDeadlineBlock}}");
    }
  });

  it("states the four-step funnel on light signup", () => {
    const es = defaultLocaleContent("light_signup", "es").body;
    expect(es).toMatch(/1\.\s+Ya estás en la lista/);
    expect(es).toMatch(/4\.\s+Confirmas tu lugar/);
  });

  it("mentions composition discretion on invite", () => {
    const es = defaultLocaleContent("calendar_invite", "es").body;
    expect(es).toMatch(/lista de nombres/i);
  });
});
