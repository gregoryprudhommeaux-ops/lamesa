import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiCandidateCard } from "./types";
import { generateTableIdeas } from "./ai-provider";

const card = (overrides: Partial<AiCandidateCard> = {}): AiCandidateCard => ({
  id: "member-1",
  company: "Analytical Engines",
  sector: "Technology",
  position: "Founder",
  city: "Mexico City",
  invitationMotivation: "Meet other founders",
  extraActivities: [],
  canBring: "Introductions to investors",
  isSeeking: "A technical cofounder",
  completionPercent: 90,
  completionBand: "high",
  invitationCount: 0,
  invitedToPreviousEvent: false,
  ...overrides,
});

const validIdea = (overrides: Partial<Record<string, unknown>> = {}) => ({
  title: "Founders & mentors",
  themeAngle: "Early-stage founders paired with operators who scaled past seed.",
  rationale:
    "Everyone here is either raising or has raised in the last 18 months, with complementary sectors.",
  commonalities: ["Recently fundraised"],
  complementarities: ["Mix of B2B and consumer sectors"],
  warnings: [],
  primaryMemberIds: ["member-1", "member-2"],
  alternateMemberIds: ["member-3"],
  ...overrides,
});

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function chatCompletion(content: string) {
  return jsonResponse({ choices: [{ message: { content } }] });
}

function configureEnv() {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_TABLE_MODEL", "test-model");
  vi.stubEnv("OPENAI_BASE_URL", "https://api.openai.com/v1");
  vi.stubEnv("AI_GATEWAY_API_KEY", "");
  vi.stubEnv("AI_GATEWAY_MODEL", "");
  vi.stubEnv("AI_GATEWAY_BASE_URL", "");
  vi.stubEnv("OPENAI_TRANSLATE_MODEL", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateTableIdeas", () => {
  it("uses a default model when only an API key is configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_TABLE_MODEL", "");
    vi.stubEnv("AI_GATEWAY_MODEL", "");
    vi.stubEnv("OPENAI_TRANSLATE_MODEL", "");

    let requestedModel = "";
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      requestedModel = body.model ?? "";
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ ideas: [validIdea()] }) } }],
        }),
      };
    });

    await generateTableIdeas({
      mode: "spontaneous",
      candidates: [card()],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(requestedModel).toBe("gpt-4o-mini");
  });

  it("throws ai_not_configured when no AI key exists", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("OPENAI_TABLE_MODEL", "");
    vi.stubEnv("AI_GATEWAY_MODEL", "");
    vi.stubEnv("OPENAI_TRANSLATE_MODEL", "");
    const fetchImpl = vi.fn();

    await expect(
      generateTableIdeas({
        mode: "spontaneous",
        candidates: [card()],
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "ai_not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws ai_invalid when model JSON fails the schema", async () => {
    configureEnv();
    const fetchImpl = vi.fn().mockResolvedValue(
      chatCompletion(JSON.stringify({ ideas: [{ title: "too short idea" }] })),
    );

    await expect(
      generateTableIdeas({
        mode: "spontaneous",
        candidates: [card()],
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "ai_invalid" });
  });

  it("sends no contact PII in the provider request", async () => {
    configureEnv();
    const candidates = [
      card({ id: "member-1" }),
      card({ id: "member-2" }),
      card({ id: "member-3" }),
    ];
    const fetchImpl = vi.fn().mockResolvedValue(
      chatCompletion(JSON.stringify({ ideas: [validIdea()] })),
    );

    await generateTableIdeas({ mode: "spontaneous", candidates, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const sentBody = String(requestInit.body ?? "");

    expect(sentBody).not.toMatch(/email/i);
    expect(sentBody).not.toMatch(/phone/i);
    expect(sentBody).not.toMatch(/linkedin/i);
    expect(sentBody).not.toMatch(/fullName/i);
    expect(sentBody).not.toMatch(/locale/i);
    expect(sentBody).not.toMatch(/\buid\b/i);
    expect(sentBody).not.toMatch(/databasePerso/i);
  });

  it("rejects ids outside the supplied candidate set", async () => {
    configureEnv();
    const candidates = [card({ id: "member-1" }), card({ id: "member-2" })];
    const fetchImpl = vi.fn().mockResolvedValue(
      chatCompletion(
        JSON.stringify({
          ideas: [
            validIdea({
              primaryMemberIds: ["member-1", "member-2", "ghost-member"],
              alternateMemberIds: ["another-ghost"],
            }),
          ],
        }),
      ),
    );

    const result = await generateTableIdeas({
      mode: "spontaneous",
      candidates,
      fetchImpl,
    });

    const [idea] = result.ideas;
    expect(idea.primaryMemberIds).toEqual(["member-1", "member-2"]);
    expect(idea.alternateMemberIds).toEqual([]);
    expect(idea.warnings.some((w) => w.includes("ghost-member"))).toBe(true);
    expect(idea.warnings.some((w) => w.includes("another-ghost"))).toBe(true);
  });

  it("parses model output wrapped in a markdown JSON fence", async () => {
    configureEnv();
    const candidates = [card({ id: "member-1" }), card({ id: "member-2" }), card({ id: "member-3" })];
    const fenced = "```json\n" + JSON.stringify({ ideas: [validIdea()] }) + "\n```";
    const fetchImpl = vi.fn().mockResolvedValue(chatCompletion(fenced));

    const result = await generateTableIdeas({
      mode: "spontaneous",
      candidates,
      fetchImpl,
    });

    expect(result.ideas).toHaveLength(1);
    expect(result.ideas[0].title).toBe("Founders & mentors");
  });

  it("throws ai_invalid when the model response is not valid JSON", async () => {
    configureEnv();
    const fetchImpl = vi.fn().mockResolvedValue(chatCompletion("not json at all"));

    await expect(
      generateTableIdeas({ mode: "spontaneous", candidates: [card()], fetchImpl }),
    ).rejects.toMatchObject({ code: "ai_invalid" });
  });

  it("never sends embedded contact values from pool-built AI cards in request JSON", async () => {
    configureEnv();
    const { buildEligiblePool } = await import("./pool");
    const pool = buildEligiblePool({
      members: [
        {
          id: "member-1",
          fullName: "Ada Lovelace",
          linkedinUrl: "https://linkedin.com/in/ada",
          email: "ada@example.com",
          company: "Engines leak@example.com",
          sector: "Tech +52 55 9999 8888",
          position: "Founder linkedin.com/in/ada-lovelace",
          extraActivities: ["Ping me at ping@example.com"],
          city: "Mexico City",
          phone: "+52 55 0000 0000",
          invitationMotivation: "Call +1-415-555-0100 or email me",
          canBring: "Intros https://www.linkedin.com/in/ada",
          isSeeking: "Partners (partners@example.org)",
          locale: "fr",
          source: "waitlist",
          tags: [],
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      participations: [],
      events: [],
      city: "Mexico City",
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      chatCompletion(JSON.stringify({ ideas: [validIdea({ primaryMemberIds: ["member-1"], alternateMemberIds: [] })] })),
    );

    await generateTableIdeas({
      mode: "spontaneous",
      candidates: pool.aiCards,
      fetchImpl,
    });

    const [, requestInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const sentBody = String(requestInit.body ?? "");
    expect(sentBody).not.toMatch(/leak@example\.com/i);
    expect(sentBody).not.toMatch(/ping@example\.com/i);
    expect(sentBody).not.toMatch(/partners@example\.org/i);
    expect(sentBody).not.toMatch(/\+52\s*55\s*9999\s*8888/);
    expect(sentBody).not.toMatch(/\+1-415-555-0100/);
    expect(sentBody).not.toMatch(/linkedin\.com\/in/i);
  });

  it("hardens the system prompt so candidate text is treated as untrusted data", async () => {
    configureEnv();
    const fetchImpl = vi.fn().mockResolvedValue(
      chatCompletion(JSON.stringify({ ideas: [validIdea()] })),
    );

    await generateTableIdeas({
      mode: "spontaneous",
      candidates: [card(), card({ id: "member-2" }), card({ id: "member-3" })],
      fetchImpl,
    });

    const [, requestInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const system = body.messages.find((m) => m.role === "system")?.content ?? "";
    expect(system.toLowerCase()).toMatch(/untrusted/);
    expect(system.toLowerCase()).toMatch(/never.*(instructions|commands)/);
  });

  it("aborts the provider request after the named timeout and maps to fetch_failed", async () => {
    configureEnv();
    const { PROVIDER_FETCH_TIMEOUT_MS } = await import("./ai-provider");
    expect(PROVIDER_FETCH_TIMEOUT_MS).toBe(20_000);

    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("missing_abort_signal"));
          return;
        }
        if (signal.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    vi.useFakeTimers();
    try {
      const pending = generateTableIdeas({
        mode: "spontaneous",
        candidates: [card()],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      const expectation = expect(pending).rejects.toMatchObject({
        code: "fetch_failed",
        message: expect.stringContaining("provider_timeout"),
      });
      await vi.advanceTimersByTimeAsync(PROVIDER_FETCH_TIMEOUT_MS);
      await expectation;
      expect(fetchImpl).toHaveBeenCalled();
      const [, requestInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(requestInit.signal).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("includes a short HTTP status diagnostic on provider errors without member data", async () => {
    configureEnv();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "rate limited" }),
      text: async () => "rate limited by upstream",
    } as unknown as Response);

    await expect(
      generateTableIdeas({ mode: "spontaneous", candidates: [card()], fetchImpl }),
    ).rejects.toMatchObject({
      code: "fetch_failed",
      message: expect.stringMatching(/429/),
    });
  });
});
