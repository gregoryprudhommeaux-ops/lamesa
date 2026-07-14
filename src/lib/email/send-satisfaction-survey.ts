import { sendReferralInviteEmail } from "@/lib/email/send-referral-invite";
import { signSurveyToken } from "@/lib/email/rsvp-token";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  applyTemplateVars,
  buildEventTemplateVars,
  getEmailTemplate,
  isEmailTemplateEnabled,
  sendLocaleForEvent,
} from "@/lib/email/templates";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { getSiteUrl } from "@/lib/site-url";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

export async function sendSatisfactionSurveyEmail(input: {
  event: AdminEvent;
  participation: AdminEventParticipation;
}): Promise<{ ok: true; surveyUrl: string } | { ok: false; error: string } | { ok: true; skipped: true; surveyUrl?: string }> {
  if (!(await isEmailTemplateEnabled("satisfaction_survey", input.event))) {
    return { ok: true, skipped: true };
  }
  const base = getSiteUrl();
  const locale = sendLocaleForEvent(input.event);
  const token = signSurveyToken({
    participationId: input.participation.id,
    eventId: input.event.id,
    email: input.participation.email,
  });
  const surveyUrl = `${base}/${locale}/satisfaction?token=${encodeURIComponent(token)}`;

  const template = await getEmailTemplate("satisfaction_survey", input.event, locale);
  const vars = buildEventTemplateVars({
    event: input.event,
    publicBaseUrl: base,
    fullName: input.participation.fullName ?? "",
    email: input.participation.email,
    surveyUrl,
    locale,
  });
  const subject = applyTemplateVars(template.subject, vars);
  const bodyText = applyTemplateVars(template.body, vars);
  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f1210;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1210;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;">
        <tr><td style="font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#b4e600;">LA MESA</td></tr>
        <tr><td style="padding-top:20px;font-size:15px;line-height:1.55;color:#222;">${textToHtml(bodyText)}</td></tr>
        <tr><td style="padding-top:24px;">
          <a href="${escapeHtml(surveyUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;">${
            locale === "en" ? "Share feedback" : locale === "fr" ? "Donner mon avis" : "Dar mi opinión"
          }</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const result = await sendTransactionalEmail({
    to: input.participation.email,
    subject,
    html,
    text: bodyText,
  });
  if (!result.ok) return result;
  return { ok: true, surveyUrl };
}

/** Platform invite after satisfaction “Yes, invite someone” — Spanish by default. */
export async function sendSatisfactionGuestInvite(input: {
  to: string;
  sponsorFullName: string;
  inviteUrl: string;
  locale?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return sendReferralInviteEmail({
    to: input.to,
    sponsorFullName: input.sponsorFullName,
    inviteUrl: input.inviteUrl,
    locale: input.locale ?? "es",
  });
}
