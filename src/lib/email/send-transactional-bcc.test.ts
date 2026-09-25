import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";

vi.mock("@/lib/email/event-mail-addressing", () => ({
  eventMailAddressing: (to: string) => ({
    to: [to],
    bcc:
      to === "gregory.prudhommeaux@gmail.com"
        ? undefined
        : ["gregory.prudhommeaux@gmail.com"],
  }),
}));

describe("sendTransactionalEmail admin BCC", () => {
  const prevKey = process.env.BREVO_API_KEY;

  beforeEach(() => {
    process.env.BREVO_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.BREVO_API_KEY = prevKey;
    vi.unstubAllGlobals();
  });

  it("does not BCC admins by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTransactionalEmail({
      to: "guest@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
    });

    expect(result).toEqual({ ok: true });
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as {
      bcc?: unknown;
    };
    expect(payload.bcc).toBeUndefined();
  });

  it("BCCs admins only when bccAdmins is true", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendTransactionalEmail({
      to: "guest@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      bccAdmins: true,
    });

    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as {
      bcc?: Array<{ email: string }>;
    };
    expect(payload.bcc?.map((b) => b.email)).toContain(
      "gregory.prudhommeaux@gmail.com",
    );
  });
});
