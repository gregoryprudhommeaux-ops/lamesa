import { describe, expect, it } from "vitest";
import { formatMesaPublicLabel, resolveMesaNumber } from "./mesa-public-label";

describe("formatMesaPublicLabel", () => {
  it("pads to three digits", () => {
    expect(formatMesaPublicLabel(1)).toBe("LA MESA 001");
    expect(formatMesaPublicLabel(12)).toBe("LA MESA 012");
  });
});

describe("resolveMesaNumber", () => {
  it("prefers explicit mesaNumber", () => {
    expect(
      resolveMesaNumber(
        { id: "b", startsAt: "2026-09-24T00:00:00Z", mesaNumber: 1 },
        [
          { id: "a", startsAt: "2026-01-01T00:00:00Z" },
          { id: "b", startsAt: "2026-09-24T00:00:00Z", mesaNumber: 1 },
        ],
      ),
    ).toBe(1);
  });

  it("falls back to chronological rank", () => {
    const pool = [
      { id: "second", startsAt: "2026-10-01T00:00:00Z" },
      { id: "first", startsAt: "2026-09-24T00:00:00Z" },
    ];
    expect(resolveMesaNumber(pool[1]!, pool)).toBe(1);
    expect(resolveMesaNumber(pool[0]!, pool)).toBe(2);
  });
});
