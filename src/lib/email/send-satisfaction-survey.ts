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
import {
  escapeEmailHtml,
  laMesaSiteFooterText,
  plainTextToEmailHtml,
  wrapLaMesaEmailHtml,
} from "@/lib/email/la-mesa-email-shell";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { getSiteUrl } from "@/lib/site-url";

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
  const cta =
    locale === "en" ? "Share feedback" : locale === "fr" ? "Donner mon avis" : "Dar mi opinión";
  const html = wrapLaMesaEmailHtml({
    lang: locale,
    bodyHtml: plainTextToEmailHtml(bodyText),
    footerHtml: `<a href="${escapeEmailHtml(surveyUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;">${escapeEmailHtml(cta)}</a>`,
  });

  const result = await sendTransactionalEmail({
    to: input.participation.email,
    subject,
    html,
    text: `${bodyText}\n\n${surveyUrl}\n\n${laMesaSiteFooterText()}`,
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
