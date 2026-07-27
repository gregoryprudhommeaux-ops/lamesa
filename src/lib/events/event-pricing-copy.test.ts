import { describe, expect, it } from "vitest";
import {
  formatAccessIncludes,
  formatMenuPriceEstimate,
  formatNegotiatedMenuBlock,
  hasNegotiatedMenuInfo,
} from "@/lib/events/event-pricing-copy";

describe("event-pricing-copy", () => {
  it("formats ACCESS inclusions", () => {
    expect(
      formatAccessIncludes(
        { accessIncludesWelcomeDrink: true, accessIncludesAmuseBouche: false },
        "es",
      ),
    ).toBe("Welcome drink");
    expect(
      formatAccessIncludes(
        { accessIncludesWelcomeDrink: true, accessIncludesAmuseBouche: true },
        "fr",
      ),
    ).toBe("Welcome drink · Amuse-bouches");
  });

  it("formats menu estimate range", () => {
    expect(
      formatMenuPriceEstimate({ menuPriceMinMxn: 500, menuPriceMaxMxn: 1500 }, "es"),
    ).toMatch(/500/);
    expect(
      formatMenuPriceEstimate({ menuPriceMinMxn: 500, menuPriceMaxMxn: 1500 }, "es"),
    ).toMatch(/1[,.]?500|1500/);
  });

  it("composes negotiated menu block", () => {
    const block = formatNegotiatedMenuBlock(
      {
        menuIncluded: "Entrada + plato",
        menuPriceMinMxn: 500,
        menuPriceMaxMxn: 1200,
        menuIncludesDrinks: false,
      },
      "es",
    );
    expect(block).toContain("Entrada + plato");
    expect(block).toContain("Estimación");
    expect(block).toContain("Bebidas no incluidas");
    expect(
      hasNegotiatedMenuInfo({
        menuIncluded: "x",
        menuPriceMinMxn: null,
        menuPriceMaxMxn: null,
        menuIncludesDrinks: null,
      }),
    ).toBe(true);
  });
});
