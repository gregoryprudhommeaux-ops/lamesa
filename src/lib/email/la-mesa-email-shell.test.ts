import { describe, expect, it } from "vitest";
import {
  LA_MESA_SITE_LINK_LABEL,
  richTextToEmailHtml,
  wrapLaMesaPlainBody,
} from "./la-mesa-email-shell";

describe("la-mesa-email-shell", () => {
  it("appends the public site link in the HTML footer", () => {
    const html = wrapLaMesaPlainBody("Hola,", { lang: "es" });
    expect(html).toContain(LA_MESA_SITE_LINK_LABEL);
    expect(html).toContain('href="https://lamesasecreta.com"');
  });

  it("renders safe <a> and <b> instead of escaping them", () => {
    const html = richTextToEmailHtml(
      'Soy <a href="https://www.linkedin.com/in/gregoryprudhommeaux/">Greg</a>, <b>LA MESA</b>.',
    );
    expect(html).toContain('href="https://www.linkedin.com/in/gregoryprudhommeaux/"');
    expect(html).toContain(">Greg</a>");
    expect(html).toContain("<b>LA MESA</b>");
    expect(html).not.toContain("&lt;a");
    expect(html).not.toContain("&lt;b");
  });

  it("escapes unknown tags and blocks non-http links", () => {
    const html = richTextToEmailHtml(
      '<script>x</script> <a href="javascript:alert(1)">x</a>',
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;a href=");
    expect(html).not.toMatch(/href="javascript:/i);
  });
});
