import { describe, expect, it } from "vitest";
import {
  sanitizeLinkedInForPerso,
  sanitizePhoneForPerso,
  sanitizeStringList,
  truncatePersoText,
} from "./perso-field-sanitize";

describe("sanitizePhoneForPerso", () => {
  it("strips annotations and keeps E.164 digits", () => {
    expect(sanitizePhoneForPerso("+523313457394 (Whatsapp only)")).toBe("+523313457394");
  });

  it("rejects too-short numbers", () => {
    expect(sanitizePhoneForPerso("12345")).toBe("");
  });
});

describe("sanitizeLinkedInForPerso", () => {
  it("normalizes bare linkedin hosts", () => {
    expect(sanitizeLinkedInForPerso("www.linkedin.com/in/josebortpoulain")).toBe(
      "https://www.linkedin.com/in/josebortpoulain",
    );
  });
});

describe("truncatePersoText / sanitizeStringList", () => {
  it("truncates long text", () => {
    expect(truncatePersoText("abcdefghij", 8)).toBe("abcdefg…");
  });

  it("caps list size and item length", () => {
    expect(sanitizeStringList(["one", "two-too-long", "three"], 2, 5)).toEqual(["one", "two-…"]);
  });
});
