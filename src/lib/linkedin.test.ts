import { describe, expect, it } from "vitest";
import { isValidLinkedInUrl, normalizeLinkedInUrl } from "./linkedin";

describe("linkedin url helpers", () => {
  it("normalizes common profile pastes", () => {
    expect(normalizeLinkedInUrl("www.linkedin.com/in/foo/")).toBe(
      "https://www.linkedin.com/in/foo",
    );
    expect(normalizeLinkedInUrl("https://mx.linkedin.com/in/ana-ramos")).toBe(
      "https://www.linkedin.com/in/ana-ramos",
    );
    expect(
      normalizeLinkedInUrl(
        "https://www.linkedin.com/in/foo?utm_source=share&utm_medium=ios_app",
      ),
    ).toBe("https://www.linkedin.com/in/foo");
  });

  it("extracts a profile URL from labeled clipboard text", () => {
    expect(
      normalizeLinkedInUrl("Profil LinkedIn : https://www.linkedin.com/in/foo"),
    ).toBe("https://www.linkedin.com/in/foo");
    expect(isValidLinkedInUrl("LinkedIn: www.linkedin.com/in/foo-bar")).toBe(true);
  });

  it("rejects company pages and short links", () => {
    expect(isValidLinkedInUrl("https://www.linkedin.com/company/la-mesa")).toBe(
      false,
    );
    expect(isValidLinkedInUrl("https://lnkd.in/abc123")).toBe(false);
  });

  it("accepts /pub/ profiles", () => {
    expect(isValidLinkedInUrl("https://www.linkedin.com/pub/john-doe/1/2/3")).toBe(
      true,
    );
  });
});
