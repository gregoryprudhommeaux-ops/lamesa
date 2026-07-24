import { describe, expect, it } from "vitest";
import {
  LA_MESA_SITE_LINK_LABEL,
  wrapLaMesaPlainBody,
} from "./la-mesa-email-shell";

describe("la-mesa-email-shell", () => {
  it("appends the public site link in the HTML footer", () => {
    const html = wrapLaMesaPlainBody("Hola,", { lang: "es" });
    expect(html).toContain(LA_MESA_SITE_LINK_LABEL);
    expect(html).toContain('href="https://lamesasecreta.com"');
  });
});
