import { describe, expect, it } from "vitest";
import {
  cancellationPolicyBlock,
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

describe("P0 email defaults", () => {
  it("puts cancellation on invite and confirmation", () => {
    for (const key of ["calendar_invite", "participation_confirmed"] as const) {
      for (const locale of ["es", "fr", "en"] as const) {
        const { body } = defaultLocaleContent(key, locale);
        expect(body).toContain(cancellationPolicyBlock(locale));
      }
    }
  });

  it("keeps payment deadline on invite", () => {
    for (const locale of ["es", "fr", "en"] as const) {
      const { body } = defaultLocaleContent("calendar_invite", locale);
      expect(body).toContain(paymentDeadlineBlock(locale));
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
