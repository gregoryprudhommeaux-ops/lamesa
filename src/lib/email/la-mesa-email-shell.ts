import { PRODUCTION_SITE_URL } from "@/lib/site-url";

/** Shared branded HTML shell for LA MESA transactional emails. */

export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain text body → HTML with line breaks (escaped). */
export function plainTextToEmailHtml(text: string): string {
  return escapeEmailHtml(text).replace(/\n/g, "<br/>");
}

const PLACEHOLDER_RE = /\uE000(\d+)\uE001/g;

function parseSafeHttpHref(attrs: string): string | null {
  const m =
    attrs.match(/href\s*=\s*"([^"]*)"/i) ||
    attrs.match(/href\s*=\s*'([^']*)'/i) ||
    attrs.match(/href\s*=\s*([^\s>]+)/i);
  if (!m) return null;
  let href = (m[1] ?? "").trim();
  href = href.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"');
  if (!/^https?:\/\//i.test(href)) return null;
  if (/[\s<>"']/.test(href)) return null;
  return href;
}

function escapeOutsidePlaceholders(s: string): string {
  return s
    .split(/(\uE000\d+\uE001)/)
    .map((part) => (/^\uE000\d+\uE001$/.test(part) ? part : escapeEmailHtml(part)))
    .join("");
}

/**
 * Template body → email HTML.
 * Allows limited inline markup: a[href=http(s)], bold, b, strong, i, em, u, br.
 * Everything else is escaped. Newlines → br.
 */
export function richTextToEmailHtml(text: string): string {
  return convertRichText(text, true);
}

/** Map authoring tags to email-safe HTML tags. */
function emailInlineTag(tag: string): string {
  const t = tag.toLowerCase();
  if (t === "bold") return "b";
  return t;
}

function convertRichText(text: string, nl2br: boolean): string {
  const placeholders: string[] = [];
  const protect = (html: string) => {
    const i = placeholders.length;
    placeholders.push(html);
    return `\uE000${i}\uE001`;
  };

  let s = text.replace(/\r\n/g, "\n");

  // Links first (http/https only); recurse on label so <b> inside links works
  s = s.replace(/<a\s+([^>]+)>([\s\S]*?)<\/a>/gi, (full, attrs: string, inner: string) => {
    const href = parseSafeHttpHref(attrs);
    if (!href) return full;
    const safeInner = convertRichText(inner, false);
    return protect(
      `<a href="${escapeEmailHtml(href)}" style="color:#2a6f2b;font-weight:600;text-decoration:underline;">${safeInner}</a>`,
    );
  });

  // Inline formats, innermost first (<bold> → <b> for email clients)
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(
      /<(bold|b|strong|i|em|u)>([\s\S]*?)<\/\1>/gi,
      (_full, tag: string, inner: string) => {
        const t = emailInlineTag(tag);
        return protect(`<${t}>${escapeOutsidePlaceholders(inner)}</${t}>`);
      },
    );
  }

  s = s.replace(/<br\s*\/?>/gi, () => protect("<br/>"));

  s = escapeOutsidePlaceholders(s);
  if (nl2br) s = s.replace(/\n/g, "<br/>");

  return s.replace(PLACEHOLDER_RE, (_, n: string) => placeholders[Number(n)] ?? "");
}

/** Display label for the public site (footer of every branded mail). */
export const LA_MESA_SITE_LINK_LABEL = "www.lamesasecreta.com";

/** Canonical href for the site footer (always production domain in emails). */
export function laMesaSiteHref(): string {
  return PRODUCTION_SITE_URL;
}

export type EmailFooterLang = "es" | "en" | "fr";

/** Normalize template / shell lang to a supported footer locale. */
export function normalizeEmailFooterLang(lang?: string | null): EmailFooterLang {
  if (lang === "fr" || lang === "en") return lang;
  return "es";
}

/** Localized label for the How it works / Fonctionnement page. */
export function laMesaFonctionnementLabel(lang?: string | null): string {
  const locale = normalizeEmailFooterLang(lang);
  if (locale === "fr") return "Fonctionnement";
  if (locale === "en") return "How it works";
  return "Funcionamiento";
}

/** Canonical href for /fonctionnement in the email locale. */
export function laMesaFonctionnementHref(lang?: string | null): string {
  const locale = normalizeEmailFooterLang(lang);
  return `${PRODUCTION_SITE_URL}/${locale}/fonctionnement`;
}

const FOOTER_LINK_STYLE =
  "color:#555;font-weight:600;text-decoration:underline;display:inline-block;padding:2px 0;";

/** HTML links: Fonctionnement then www.lamesasecreta.com (one per line for email clients). */
export function laMesaSiteLinksHtml(lang?: string | null): string {
  const howHref = escapeEmailHtml(laMesaFonctionnementHref(lang));
  const howLabel = escapeEmailHtml(laMesaFonctionnementLabel(lang));
  const siteHref = escapeEmailHtml(laMesaSiteHref());
  const siteLabel = escapeEmailHtml(LA_MESA_SITE_LINK_LABEL);
  return [
    `<a href="${howHref}" style="${FOOTER_LINK_STYLE}">${howLabel}</a>`,
    `<br/>`,
    `<a href="${siteHref}" style="${FOOTER_LINK_STYLE}">${siteLabel}</a>`,
  ].join("");
}

/** Plain-text site lines for multipart emails. */
export function laMesaSiteFooterText(lang?: string | null): string {
  return `${laMesaFonctionnementLabel(lang)}: ${laMesaFonctionnementHref(lang)}\n${LA_MESA_SITE_LINK_LABEL}: ${laMesaSiteHref()}`;
}

/** HTML row: site links at the bottom of the white card. */
export function laMesaSiteFooterHtml(lang?: string | null): string {
  return `<tr><td style="padding-top:28px;border-top:1px solid #eeeeee;font-size:12px;line-height:1.4;color:#777;">
  ${laMesaSiteLinksHtml(lang)}
</td></tr>`;
}

/** Member account settings (delete profile / opt out of emails). */
export function laMesaMemberSettingsUrl(lang?: string | null): string {
  const locale = normalizeEmailFooterLang(lang);
  return `${PRODUCTION_SITE_URL}/${locale}/reglages`;
}

type LegalFooterCopy = {
  beforeLink: string;
  linkLabel: string;
  afterLink: string;
};

function legalFooterCopy(lang: EmailFooterLang): LegalFooterCopy {
  switch (lang) {
    case "fr":
      return {
        beforeLink:
          "Vous recevez cet e-mail parce que vous avez été identifié comme probablement intéressé par ce qu'on propose, ou vous êtes déjà inscrit(e) à LA MESA. Si vous ne souhaitez plus recevoir d'e-mails, vous pouvez supprimer votre profil dans vos ",
        linkLabel: "réglages",
        afterLink: ', ou répondre à cet email en mentionnant "UNSUBSCRIBE".',
      };
    case "en":
      return {
        beforeLink:
          "You're receiving this email because you were identified as likely interested in what we offer, or you're already registered with LA MESA. If you no longer wish to receive emails, you can delete your profile in ",
        linkLabel: "account settings",
        afterLink: ', or reply to this email mentioning "UNSUBSCRIBE".',
      };
    default:
      return {
        beforeLink:
          "Recibes este correo porque te identificamos como probablemente interesado(a) en lo que ofrecemos, o ya estás registrado(a) en LA MESA. Si ya no deseas recibir correos, puedes eliminar tu perfil en ",
        linkLabel: "ajustes de la cuenta",
        afterLink: ', o responder a este correo mencionando "UNSUBSCRIBE".',
      };
  }
}

export type LaMesaEmailFooterOptions = {
  /** Default true — member-facing mails. */
  includeLegal?: boolean;
  /** Default true. */
  includeSite?: boolean;
};

/** HTML row: legal notice + optional site link at the bottom of the white card. */
export function laMesaEmailFooterHtml(
  lang?: string | null,
  options: LaMesaEmailFooterOptions = {},
): string {
  const locale = normalizeEmailFooterLang(lang);
  const includeLegal = options.includeLegal !== false;
  const includeSite = options.includeSite !== false;
  if (!includeLegal && !includeSite) return "";

  const parts: string[] = [];
  if (includeLegal) {
    const copy = legalFooterCopy(locale);
    const settingsUrl = escapeEmailHtml(laMesaMemberSettingsUrl(locale));
    const linkLabel = escapeEmailHtml(copy.linkLabel);
    parts.push(
      `${escapeEmailHtml(copy.beforeLink)}<a href="${settingsUrl}" style="color:#555;font-weight:600;text-decoration:underline;">${linkLabel}</a>${escapeEmailHtml(copy.afterLink)}`,
    );
  }
  if (includeSite) {
    parts.push(laMesaSiteLinksHtml(locale));
  }

  const inner = includeLegal && includeSite ? parts.join("<br/><br/>") : parts.join("");
  return `<tr><td style="padding-top:28px;border-top:1px solid #eeeeee;font-size:11px;line-height:1.5;color:#888;">${inner}</td></tr>`;
}

/** @deprecated Prefer laMesaEmailFooterHtml — kept for callers that only need the site row. */
export function laMesaLegalFooterHtml(lang?: string | null): string {
  return laMesaEmailFooterHtml(lang, { includeLegal: true, includeSite: false });
}

/** Plain-text legal + site lines for multipart member emails. */
export function laMesaEmailFooterText(
  lang?: string | null,
  options: LaMesaEmailFooterOptions = {},
): string {
  const locale = normalizeEmailFooterLang(lang);
  const includeLegal = options.includeLegal !== false;
  const includeSite = options.includeSite !== false;
  const lines: string[] = [];
  if (includeLegal) {
    const copy = legalFooterCopy(locale);
    const settingsUrl = laMesaMemberSettingsUrl(locale);
    lines.push(`${copy.beforeLink}${copy.linkLabel} (${settingsUrl})${copy.afterLink}`);
  }
  if (includeSite) lines.push(laMesaSiteFooterText(locale));
  return lines.join("\n\n");
}

export type LaMesaEmailShellOptions = {
  /** Main body HTML (already escaped / safe). */
  bodyHtml: string;
  /** Optional heading under the LA MESA mark */
  title?: string;
  /** Optional extra HTML below the body (CTA row, etc.) */
  footerHtml?: string;
  lang?: string;
  maxWidthPx?: number;
  /** When false, omit the legal opt-out footer. Default true for member mails. */
  includeLegalFooter?: boolean;
  /** When false, omit the site link footer (rare). Default true. */
  includeSiteLink?: boolean;
};

/**
 * Dark outer frame + white card + lime LA MESA mark — same look as invites / waitlist mails.
 * Appends legal notice + www.lamesasecreta.com at the bottom (unless disabled).
 */
export function wrapLaMesaEmailHtml(options: LaMesaEmailShellOptions): string {
  const lang = options.lang ?? "es";
  const maxWidth = options.maxWidthPx ?? 520;
  const titleRow = options.title?.trim()
    ? `<tr><td style="padding-top:16px;font-size:18px;font-weight:700;color:#111;">${escapeEmailHtml(options.title.trim())}</td></tr>`
    : "";
  const footerRow = options.footerHtml?.trim()
    ? `<tr><td style="padding-top:24px;">${options.footerHtml}</td></tr>`
    : "";
  const emailFooterRow = laMesaEmailFooterHtml(lang, {
    includeLegal: options.includeLegalFooter !== false,
    includeSite: options.includeSiteLink !== false,
  });

  return `<!DOCTYPE html>
<html lang="${escapeEmailHtml(lang)}">
<body style="margin:0;padding:0;background:#0f1210;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1210;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:${maxWidth}px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td style="font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#b4e600;">LA MESA</td></tr>
          ${titleRow}
          <tr><td style="padding-top:20px;font-size:15px;line-height:1.55;color:#222;word-break:break-word;overflow-wrap:anywhere;">${options.bodyHtml}</td></tr>
          ${footerRow}
          ${emailFooterRow}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Wrap a template body in the LA MESA shell (preview + simple sends). Allows safe inline HTML. */
export function wrapLaMesaPlainBody(bodyText: string, opts?: { title?: string; lang?: string }): string {
  return wrapLaMesaEmailHtml({
    bodyHtml: richTextToEmailHtml(bodyText),
    title: opts?.title,
    lang: opts?.lang,
  });
}
