import { describe, expect, it } from "vitest";
import { splitPaymentRelanceBatch } from "@/lib/events/payment-relance-batch";

describe("splitPaymentRelanceBatch", () => {
  it("sends only guests who have not received the payment reminder", () => {
    const { toSend, alreadySent } = splitPaymentRelanceBatch([
      { email: "new@example.com" },
      { email: "done@example.com", paymentRelanceSentAt: "2026-09-25T12:00:00.000Z" },
      { email: "blank@example.com", paymentRelanceSentAt: "   " },
    ]);
    expect(toSend.map((r) => r.email)).toEqual(["new@example.com", "blank@example.com"]);
    expect(alreadySent.map((r) => r.email)).toEqual(["done@example.com"]);
  });
});
