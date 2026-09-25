import { describe, expect, it } from "vitest";
import {
  satisfactionBodyToHtml,
  satisfactionSurveyButtonHtml,
  satisfactionSurveyCtaLabel,
} from "@/lib/email/send-satisfaction-survey";

describe("satisfaction survey email HTML", () => {
  it("exposes localized CTA labels", () => {
    expect(satisfactionSurveyCtaLabel("fr")).toBe("Donner mon avis");
    expect(satisfactionSurveyCtaLabel("es")).toBe("Dar mi opinión");
    expect(satisfactionSurveyCtaLabel("en")).toBe("Share feedback");
  });

  it("renders a pill CTA button (not a raw URL as label)", () => {
    const url = "https://lamesasecreta.com/fr/satisfaction?token=abc";
    const html = satisfactionSurveyButtonHtml(url, "fr");
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain(">Donner mon avis</a>");
    expect(html).toContain("background:#b4e600");
    expect(html).not.toMatch(/>https?:\/\//);
  });

  it("strips surveyUrl from the body so only the button carries the link", () => {
    const url = "https://lamesasecreta.com/fr/satisfaction?token=abc";
    const body = [
      "Bonjour Test,",
      "",
      "Dis-nous comment c’était. Ça nous sert pour la prochaine table :",
      url,
      "",
      "À bientôt,",
      "LA MESA",
    ].join("\n");

    const html = satisfactionBodyToHtml(body, url);
    expect(html).toContain("Dis-nous comment c");
    expect(html).not.toContain("satisfaction?token=");
    expect(html).not.toContain(url);
  });

  it("also strips legacy /survey/demo placeholders from test bodies", () => {
    const url = "https://lamesasecreta.com/fr/survey/demo";
    const html = satisfactionBodyToHtml(`Lien :\n${url}\n`, url);
    expect(html).not.toContain("survey/demo");
  });
});
