import { afterEach, describe, expect, it, vi } from "vitest";
import type { WaitlistRegistration } from "@/lib/types/events";
import { AI_CANDIDATE_CAP, composeTableIdeas } from "./index";

const member = (
  overrides: Partial<WaitlistRegistration> = {},
): WaitlistRegistration => ({
  id: "member-1",
  fullName: "Ada Lovelace",
  linkedinUrl: "https://linkedin.com/in/ada",
  email: "ada@example.com",
  company: "Analytical Engines",
  sector: "Technology",
  position: "Founder",
  extraActivities: [],
  city: "Mexico City",
  phone: "+52 55 0000 0000",
  invitationMotivation: "Meet founders",
  canBring: "Intros",
  isSeeking: "Partners",
  locale: "fr",
  source: "waitlist",
  tags: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

function configureEnv() {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_TABLE_MODEL", "test-model");
  vi.stubEnv("OPENAI_BASE_URL", "https://api.openai.com/v1");
  vi.stubEnv("AI_GATEWAY_API_KEY", "");
  vi.stubEnv("AI_GATEWAY_MODEL", "");
  vi.stubEnv("AI_GATEWAY_BASE_URL", "");
  vi.stubEnv("OPENAI_TRANSLATE_MODEL", "");
}

function mockIdea(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: "Founders table",
    themeAngle: "Operators who recently raised.",
    rationale: "Shared fundraising stage with complementary sectors.",
    commonalities: ["Recently fundraised"],
    complementarities: ["Sector mix"],
    warnings: [] as string[],
    primaryMemberIds: [] as string[],
    alternateMemberIds: [] as string[],
    ...overrides,
  };
}

function chatFetch(ideas: ReturnType<typeof mockIdea>[], onBody?: (body: string) => void) {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    onBody?.(String(init?.body ?? ""));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ ideas }) } }],
      }),
      text: async () => "",
    } as unknown as Response;
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("composeTableIdeas", () => {
  it("caps AI candidates at 80 after deterministic ranking", async () => {
    configureEnv();
    const members = Array.from({ length: 100 }, (_, index) =>
      member({
        id: `member-${String(index + 1).padStart(3, "0")}`,
        email: `m${index + 1}@example.com`,
        company: `Company ${index + 1}`,
        sector: `Sector ${index + 1}`,
        // Lower id numbers get slightly better completion so ranking prefers them
        // when invitation history is equal — padStart keeps id order stable.
      }),
    );

    let capturedCandidateCount = 0;
    const fetchImpl = chatFetch(
      [
        mockIdea({
          primaryMemberIds: ["member-001"],
          alternateMemberIds: [],
        }),
      ],
      (body) => {
        const parsed = JSON.parse(body) as {
          messages: Array<{ role: string; content: string }>;
        };
        const user = parsed.messages.find((m) => m.role === "user")?.content ?? "";
        const jsonStart = user.indexOf("[");
        const cards = JSON.parse(user.slice(jsonStart)) as unknown[];
        capturedCandidateCount = cards.length;
      },
    );

    await composeTableIdeas({
      mode: "spontaneous",
      members,
      participations: [],
      events: [],
      city: "Mexico City",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(AI_CANDIDATE_CAP).toBe(80);
    expect(capturedCandidateCount).toBe(80);
  });

  it("reconciles unknown and duplicate ids then fills to 15 primary and 5 alternates", async () => {
    configureEnv();
    const members = Array.from({ length: 25 }, (_, index) =>
      member({
        id: `member-${index + 1}`,
        email: `m${index + 1}@example.com`,
        company: `Company ${index + 1}`,
        sector: `Sector ${index + 1}`,
      }),
    );
    const fetchImpl = chatFetch([
      mockIdea({
        primaryMemberIds: ["member-1", "member-1", "ghost", "member-2"],
        alternateMemberIds: ["ghost-alt", "member-2"],
      }),
    ]);

    const { ideas, poolSize } = await composeTableIdeas({
      mode: "spontaneous",
      members,
      participations: [],
      events: [],
      city: "Mexico City",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(poolSize).toBe(25);
    expect(ideas).toHaveLength(1);
    const [idea] = ideas;
    expect(idea.primary).toHaveLength(15);
    expect(idea.alternates).toHaveLength(5);
    const seated = [...idea.primary, ...idea.alternates].map((s) => s.id);
    expect(new Set(seated).size).toBe(20);
    expect(seated).not.toContain("ghost");
    expect(seated).not.toContain("ghost-alt");
    expect(idea.warnings.some((w) => w.includes("ghost"))).toBe(true);
    expect(idea.warnings.some((w) => /duplicate/i.test(w))).toBe(true);
  });

  it("propagates pool-too-small warnings from canonical balancing", async () => {
    configureEnv();
    const members = Array.from({ length: 8 }, (_, index) =>
      member({
        id: `member-${index + 1}`,
        email: `m${index + 1}@example.com`,
        company: `Company ${index + 1}`,
        sector: `Sector ${index + 1}`,
      }),
    );
    const fetchImpl = chatFetch([
      mockIdea({
        primaryMemberIds: ["member-1", "member-2"],
        alternateMemberIds: [],
      }),
    ]);

    const { ideas } = await composeTableIdeas({
      mode: "spontaneous",
      members,
      participations: [],
      events: [],
      city: "Mexico City",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(ideas[0].warnings.some((w) => w.includes("pool too small"))).toBe(true);
    expect(ideas[0].primary.length + ideas[0].alternates.length).toBe(8);
  });

  it("propagates referral-pair warnings for the final primary seats", async () => {
    configureEnv();
    const members = [
      member({ id: "referrer", email: "ref@example.com", company: "Ref Co" }),
      member({
        id: "referral",
        email: "referral@example.com",
        company: "Referral Co",
        referredById: "referrer",
      }),
      ...Array.from({ length: 18 }, (_, index) =>
        member({
          id: `other-${index + 1}`,
          email: `o${index + 1}@example.com`,
          company: `Other ${index + 1}`,
          sector: `Sector ${index + 1}`,
        }),
      ),
    ];
    const fetchImpl = chatFetch([
      mockIdea({
        primaryMemberIds: ["referrer", "referral"],
        alternateMemberIds: [],
      }),
    ]);

    const { ideas } = await composeTableIdeas({
      mode: "spontaneous",
      members,
      participations: [],
      events: [],
      city: "Mexico City",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(ideas[0].warnings.some((w) => w.includes("referral pair"))).toBe(true);
    // Dedup: warning should appear once even if also produced elsewhere
    expect(ideas[0].warnings.filter((w) => w.includes("referral pair"))).toHaveLength(1);
  });

  it("fills missing primary seats with company/sector soft balancing around AI picks", async () => {
    configureEnv();
    // AI locks in 4 Finance seats already. Remaining Finance candidates must be
    // soft-penalized so diversifiers fill the remaining primary seats.
    const financeSeed = Array.from({ length: 4 }, (_, index) =>
      member({
        id: `finance-seed-${index + 1}`,
        email: `fs${index + 1}@example.com`,
        company: `Finance Seed ${index + 1}`,
        sector: "Finance",
      }),
    );
    const financeFillers = Array.from({ length: 6 }, (_, index) =>
      member({
        id: `finance-fill-${index + 1}`,
        email: `ff${index + 1}@example.com`,
        company: `Finance Fill ${index + 1}`,
        sector: "Finance",
      }),
    );
    const diversifiers = Array.from({ length: 12 }, (_, index) =>
      member({
        id: `other-${index + 1}`,
        email: `o${index + 1}@example.com`,
        company: `Other ${index + 1}`,
        sector: `Sector ${index + 1}`,
      }),
    );
    // Also include a same-company twin of the first AI pick — should be avoided.
    const sameCompany = member({
      id: "acme-twin",
      email: "twin@example.com",
      company: "  ACME CORP ",
      sector: "Retail",
    });
    const acmeSeed = member({
      id: "acme-seed",
      email: "acme@example.com",
      company: "Acme Corp",
      sector: "Retail",
    });

    const fetchImpl = chatFetch([
      mockIdea({
        primaryMemberIds: [
          "acme-seed",
          ...financeSeed.map((m) => m.id),
        ],
        alternateMemberIds: [],
      }),
    ]);

    const { ideas } = await composeTableIdeas({
      mode: "spontaneous",
      members: [acmeSeed, sameCompany, ...financeSeed, ...financeFillers, ...diversifiers],
      participations: [],
      events: [],
      city: "Mexico City",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const primaryIds = ideas[0].primary.map((s) => s.id);
    expect(primaryIds).toHaveLength(15);
    expect(primaryIds).toContain("acme-seed");
    expect(primaryIds).not.toContain("acme-twin");
    const financeCount = ideas[0].primary.filter((s) => s.sector === "Finance").length;
    expect(financeCount).toBeLessThanOrEqual(5); // 4 AI seed + at most soft-capped extras
  });

  it("falls back to a deterministic composition when AI is not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("OPENAI_TABLE_MODEL", "");
    vi.stubEnv("AI_GATEWAY_MODEL", "");
    vi.stubEnv("OPENAI_TRANSLATE_MODEL", "");

    const members = Array.from({ length: 20 }, (_, index) =>
      member({
        id: `m-${index + 1}`,
        email: `m${index + 1}@example.com`,
        company: `Company ${index + 1}`,
        sector: index % 2 === 0 ? "tech" : "finance",
      }),
    );

    const fetchImpl = vi.fn();
    const { ideas, poolSize } = await composeTableIdeas({
      mode: "spontaneous",
      members,
      participations: [],
      events: [],
      city: "Mexico City",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(poolSize).toBe(20);
    expect(ideas).toHaveLength(1);
    expect(ideas[0].primary).toHaveLength(15);
    expect(ideas[0].alternates).toHaveLength(5);
    expect(ideas[0].warnings.some((w) => /IA non configurée|déterministe/i.test(w))).toBe(true);
  });
});
