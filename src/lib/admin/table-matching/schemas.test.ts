import { describe, expect, it } from "vitest";
import { aiTableIdeasSchema, tableIdeasRequestSchema } from "./schemas";

const baseIdea = (overrides: Partial<Record<string, unknown>> = {}) => ({
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

describe("tableIdeasRequestSchema", () => {
  it("requires a theme only in admin_theme mode", () => {
    const spontaneous = tableIdeasRequestSchema.safeParse({
      city: "Ciudad de México",
      mode: "spontaneous",
    });
    expect(spontaneous.success).toBe(true);

    const missingTheme = tableIdeasRequestSchema.safeParse({
      city: "Ciudad de México",
      mode: "admin_theme",
    });
    expect(missingTheme.success).toBe(false);

    const withTheme = tableIdeasRequestSchema.safeParse({
      city: "Ciudad de México",
      mode: "admin_theme",
      theme: "Founders who scaled past seed",
    });
    expect(withTheme.success).toBe(true);
  });

  it("defaults excludeMemberIds to an empty array", () => {
    const parsed = tableIdeasRequestSchema.safeParse({
      city: "Ciudad de México",
      mode: "spontaneous",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.excludeMemberIds).toEqual([]);
    }
  });

  it("rejects free-text cities that are not hubs", () => {
    const parsed = tableIdeasRequestSchema.safeParse({
      city: "Zapopan",
      mode: "spontaneous",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("aiTableIdeasSchema", () => {
  it("rejects an AI idea with more than 15 primary ids", () => {
    const tooManyPrimary = Array.from({ length: 16 }, (_, index) => `member-${index + 1}`);
    const parsed = aiTableIdeasSchema.safeParse({
      ideas: [baseIdea({ primaryMemberIds: tooManyPrimary })],
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a well-formed idea list", () => {
    const parsed = aiTableIdeasSchema.safeParse({ ideas: [baseIdea()] });
    expect(parsed.success).toBe(true);
  });
});
