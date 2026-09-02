import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  applyTemplateVars,
  getEmailTemplate,
  isEmailTemplateEnabled,
  resolveTemplateLocale,
  type TemplateVars,
} from "@/lib/email/templates";
import {
  escapeEmailHtml,
  laMesaEmailFooterText,
  wrapLaMesaEmailHtml,
} from "@/lib/email/la-mesa-email-shell";
import type { TemplateLocale } from "@/lib/types/events";

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
  let html = escapeEmailHtml(prepared).replace(/\n/g, "<br/>");
  if (inviteUrl) {
    html = html.split(TOKEN).join(
      `<a href="${escapeEmailHtml(inviteUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;margin:8px 0;">${escapeEmailHtml(label)}</a>`,
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

  const html = wrapLaMesaEmailHtml({
    lang: locale,
    bodyHtml,
  });

  return sendTransactionalEmail({
    to: input.to,
    subject,
    html,
    text: `${bodyText}\n\n${laMesaEmailFooterText(locale)}`,
  });
}
