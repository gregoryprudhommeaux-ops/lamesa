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
 * Allows limited inline markup: a[href=http(s)], b, strong, i, em, u, br.
 * Everything else is escaped. Newlines → br.
 */
export function richTextToEmailHtml(text: string): string {
  return convertRichText(text, true);
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

  // Inline formats, innermost first
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(
      /<(b|strong|i|em|u)>([\s\S]*?)<\/\1>/gi,
      (_full, tag: string, inner: string) => {
        const t = tag.toLowerCase();
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

/** HTML row: site link at the bottom of the white card. */
export function laMesaSiteFooterHtml(): string {
  const href = escapeEmailHtml(laMesaSiteHref());
  const label = escapeEmailHtml(LA_MESA_SITE_LINK_LABEL);
  return `<tr><td style="padding-top:28px;border-top:1px solid #eeeeee;font-size:12px;line-height:1.4;color:#777;">
  <a href="${href}" style="color:#555;font-weight:600;text-decoration:underline;">${label}</a>
</td></tr>`;
}

/** Plain-text site line for multipart emails. */
export function laMesaSiteFooterText(): string {
  return LA_MESA_SITE_LINK_LABEL;
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
  /** When false, omit the site link footer (rare). Default true. */
  includeSiteLink?: boolean;
};

/**
 * Dark outer frame + white card + lime LA MESA mark — same look as invites / waitlist mails.
 * Always appends www.lamesasecreta.com at the bottom of the card (unless includeSiteLink: false).
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
  const siteRow = options.includeSiteLink === false ? "" : laMesaSiteFooterHtml();

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
          ${siteRow}
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
