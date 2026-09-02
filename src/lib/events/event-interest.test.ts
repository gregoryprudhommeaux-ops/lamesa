import { describe, expect, it } from "vitest";
import {
  eventInterestSchema,
  isInterestDeadlinePassed,
  splitFullName,
} from "./event-interest";

describe("eventInterestSchema", () => {
  it("accepts YES with expectations", () => {
    const parsed = eventInterestSchema.safeParse({
      interestResponse: "yes",
      expectations: "Échanger entre fondateurs FR",
    });
    expect(parsed.success).toBe(true);
  });

  it("requires decline reason on NO", () => {
    const parsed = eventInterestSchema.safeParse({
      interestResponse: "no",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires other text on OTHER", () => {
    const parsed = eventInterestSchema.safeParse({
      interestResponse: "other",
    });
    expect(parsed.success).toBe(false);
  });

  it("ignores guest identity fields (auth supplies profile)", () => {
    const parsed = eventInterestSchema.safeParse({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      interestResponse: "yes",
      expectations: "ok",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("email");
    }
  });
});

describe("splitFullName", () => {
  it("splits first and last", () => {
    expect(splitFullName("Ada Lovelace")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
    });
  });
});

describe("isInterestDeadlinePassed", () => {
  it("returns false when no deadline", () => {
    expect(isInterestDeadlinePassed(null)).toBe(false);
  });

  it("detects past deadline", () => {
    expect(isInterestDeadlinePassed("2020-01-01T00:00:00.000Z")).toBe(true);
  });
});
