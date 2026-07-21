import { describe, expect, it } from "vitest";
import {
  citiesInSameHub,
  resolveCityHub,
} from "./city-hubs";

describe("resolveCityHub", () => {
  it("maps ZMG suburbs and typos to Guadalajara", () => {
    expect(resolveCityHub("Zapopan")).toBe("Guadalajara");
    expect(resolveCityHub("Tlaquepaque")).toBe("Guadalajara");
    expect(resolveCityHub("Tlajomulco de Zúñiga")).toBe("Guadalajara");
    expect(resolveCityHub("Guadalajada")).toBe("Guadalajara");
    expect(resolveCityHub("GUADALAJARA")).toBe("Guadalajara");
    expect(resolveCityHub("  Guadalajara  ")).toBe("Guadalajara");
  });

  it("maps Autre/Other to Otro", () => {
    expect(resolveCityHub("Autre")).toBe("Otro");
    expect(resolveCityHub("Other")).toBe("Otro");
  });

  it("maps CDMX aliases", () => {
    expect(resolveCityHub("CDMX")).toBe("Ciudad de México");
    expect(resolveCityHub("Mexico City")).toBe("Ciudad de México");
  });

  it("returns null for empty or unknown", () => {
    expect(resolveCityHub("")).toBeNull();
    expect(resolveCityHub("   ")).toBeNull();
    expect(resolveCityHub("Paris")).toBeNull();
  });
});

describe("citiesInSameHub", () => {
  it("treats Zapopan and Guadalajara as the same hub", () => {
    expect(citiesInSameHub("Zapopan", "Guadalajara")).toBe(true);
    expect(citiesInSameHub("Monterrey", "Guadalajara")).toBe(false);
  });
});
