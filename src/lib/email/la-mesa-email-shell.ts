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
          <tr><td style="padding-top:20px;font-size:15px;line-height:1.55;color:#222;">${options.bodyHtml}</td></tr>
          ${footerRow}
          ${siteRow}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Wrap a plain-text template body in the LA MESA shell (for preview + simple sends). */
export function wrapLaMesaPlainBody(bodyText: string, opts?: { title?: string; lang?: string }): string {
  return wrapLaMesaEmailHtml({
    bodyHtml: plainTextToEmailHtml(bodyText),
    title: opts?.title,
    lang: opts?.lang,
  });
}
