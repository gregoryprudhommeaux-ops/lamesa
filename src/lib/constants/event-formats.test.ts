import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVENT_FORMAT,
  labelEventFormat,
  resolveEventFormat,
} from "./event-formats";

describe("event formats", () => {
  it("defaults unknown values to dinner", () => {
    expect(resolveEventFormat(undefined)).toBe(DEFAULT_EVENT_FORMAT);
    expect(resolveEventFormat("brunch")).toBe("dinner");
  });

  it("labels Apéro / Afterwork / Drinks for aperitif", () => {
    expect(labelEventFormat("aperitif", "fr")).toBe("Apéro");
    expect(labelEventFormat("aperitif", "es")).toBe("Afterwork");
    expect(labelEventFormat("aperitif", "en")).toBe("Drinks");
  });
});
