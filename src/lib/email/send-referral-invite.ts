import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  applyTemplateVars,
  getEmailTemplate,
  isEmailTemplateEnabled,
  resolveTemplateLocale,
  type TemplateVars,
} from "@/lib/email/templates";
import type { TemplateLocale } from "@/lib/types/events";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ctaLabel(locale: TemplateLocale): string {
  if (locale === "fr") return "S’inscrire gratuitement";
  if (locale === "en") return "Sign up for free";
  return "Registrarme sin costo";
}

function sponsorFallback(locale: TemplateLocale): string {
  if (locale === "en") return "A friend";
  if (locale === "fr") return "Un ami";
  return "Un amigo";
}

function textToHtml(text: string, inviteUrl: string, label: string): string {
  const TOKEN = "__LM_INVITE__";
  let prepared = text;
  if (inviteUrl) prepared = prepared.split(inviteUrl).join(TOKEN);
  let html = escapeHtml(prepared).replace(/\n/g, "<br/>");
  if (inviteUrl) {
    html = html.split(TOKEN).join(
      `<a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;margin:8px 0;">${escapeHtml(label)}</a>`,
    );
  }
  return html;
}

export async function sendReferralInviteEmail(input: {
  to: string;
  sponsorFullName: string;
  inviteUrl: string;
  locale?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: true }> {
  if (!(await isEmailTemplateEnabled("referral_invite"))) {
    return { ok: true, skipped: true };
  }

  const locale = resolveTemplateLocale(input.locale);
  const sponsor = input.sponsorFullName.trim() || sponsorFallback(locale);
  const template = await getEmailTemplate("referral_invite", null, locale);
  const vars: TemplateVars = {
    fullName: sponsor,
    sponsorName: sponsor,
    inviteUrl: input.inviteUrl,
    eventTitle: "",
    when: "",
    where: "",
    eventUrl: "",
  };
  const subject = applyTemplateVars(template.subject, vars);
  const bodyText = applyTemplateVars(template.body, vars);
  const bodyHtml = textToHtml(bodyText, input.inviteUrl, ctaLabel(locale));

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<body style="margin:0;padding:0;background:#0f1210;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1210;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td style="font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#b4e600;">LA MESA</td></tr>
          <tr><td style="padding-top:16px;font-size:15px;line-height:1.55;color:#333;">${bodyHtml}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendTransactionalEmail({
    to: input.to,
    subject,
    html,
    text: bodyText,
    bccAdmins: false,
  });
}
