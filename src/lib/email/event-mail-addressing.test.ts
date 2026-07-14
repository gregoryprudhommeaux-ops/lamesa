import { describe, expect, it } from "vitest";
import { eventMailAddressing } from "@/lib/email/event-mail-addressing";

describe("eventMailAddressing", () => {
  it("puts admin in bcc when sending to a guest", () => {
    const result = eventMailAddressing("guest@example.com");
    expect(result.to).toEqual(["guest@example.com"]);
    expect(result.bcc).toContain("gregory.prudhommeaux@gmail.com");
  });

  it("does not bcc when the recipient is already the admin", () => {
    const result = eventMailAddressing("gregory.prudhommeaux@gmail.com");
    expect(result.to).toEqual(["gregory.prudhommeaux@gmail.com"]);
    expect(result.bcc).toBeUndefined();
  });
});
