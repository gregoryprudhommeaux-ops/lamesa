import { buildCalendarInviteIcs } from "@/lib/email/ics";
import { signRsvpToken } from "@/lib/email/rsvp-token";
import { brevoFromAddress, sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  applyTemplateVars,
  buildEventTemplateVars,
  getEmailTemplate,
  isEmailTemplateEnabled,
  sendLocaleForEvent,
} from "@/lib/email/templates";
import {
  wrapLaMesaEmailHtml,
  wrapLaMesaPlainBody,
  laMesaSiteFooterText,
} from "@/lib/email/la-mesa-email-shell";
import { getSiteUrl } from "@/lib/site-url";
import type { AdminEvent, AdminEventParticipation, TemplateLocale } from "@/lib/types/events";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn RSVP / event URLs in the template body into short clickable labels in HTML. */
export function inviteBodyToHtml(
  bodyText: string,
  yesUrl: string,
  noUrl: string,
  eventUrl: string,
): string {
  const YES = "__LM_YES__";
  const NO = "__LM_NO__";
  const EVENT = "__LM_EVENT__";

  let prepared = bodyText;
  if (yesUrl) prepared = prepared.split(yesUrl).join(YES);
  if (noUrl) prepared = prepared.split(noUrl).join(NO);
  if (eventUrl) prepared = prepared.split(eventUrl).join(EVENT);

  prepared = prepared
    .replace(/YES\s*:?\s*__LM_YES__/gi, YES)
    .replace(/NO\s*:?\s*__LM_NO__/gi, NO);

  let html = escapeHtml(prepared).replace(/\n/g, "<br/>");

  const linkStyle =
    "color:#111111;font-weight:800;text-decoration:underline;letter-spacing:0.04em;";
  html = html
    .split(YES)
    .join(`<a href="${escapeHtml(yesUrl)}" style="${linkStyle}">YES</a>`)
    .split(NO)
    .join(`<a href="${escapeHtml(noUrl)}" style="${linkStyle}">NO</a>`)
    .split(EVENT)
    .join(
      `<a href="${escapeHtml(eventUrl)}" style="color:#2a6f2b;font-weight:600;text-decoration:underline;">${escapeHtml(eventUrl)}</a>`,
    );

  return html;
}

export async function sendCalendarInviteEmail(input: {
  event: AdminEvent;
  participation: AdminEventParticipation;
  locale?: TemplateLocale;
}): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: true }> {
  if (!(await isEmailTemplateEnabled("calendar_invite", input.event))) {
    return { ok: true, skipped: true };
  }
  const base = getSiteUrl();
  const token = signRsvpToken({
    participationId: input.participation.id,
    eventId: input.event.id,
    email: input.participation.email,
  });
  const locale = input.locale ?? sendLocaleForEvent(input.event);
  const encoded = encodeURIComponent(token);
  const yesUrl = `${base}/api/rsvp/${encoded}?response=yes&locale=${locale}`;
  const noUrl = `${base}/api/rsvp/${encoded}?response=no&locale=${locale}`;

  const template = await getEmailTemplate("calendar_invite", input.event, locale);
  const vars = buildEventTemplateVars({
    event: input.event,
    publicBaseUrl: base,
    fullName: input.participation.fullName ?? "",
    email: input.participation.email,
    yesUrl,
    noUrl,
    locale,
  });
  const subject = applyTemplateVars(template.subject, vars);
  const bodyText = applyTemplateVars(template.body, vars);

  const location = [input.event.venueName, input.event.address].filter(Boolean).join(" — ");
  const from = brevoFromAddress();
  const ics = buildCalendarInviteIcs({
    uid: `${input.event.id}-${input.participation.id}@lamesa`,
    title: `LA MESA — ${input.event.title}`,
    description: bodyText.slice(0, 1500),
    location,
    startsAt: input.event.startsAt,
    endsAt: input.event.endsAt,
    organizerEmail: from.email,
    organizerName: input.event.organizerName ?? from.name ?? "LA MESA",
    attendeeEmail: input.participation.email,
    attendeeName: input.participation.fullName,
    url: vars.eventUrl,
  });

  const html = wrapLaMesaEmailHtml({
    lang: locale,
    bodyHtml: inviteBodyToHtml(bodyText, yesUrl, noUrl, vars.eventUrl),
    footerHtml: `
          <a href="${escapeHtml(yesUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:999px;margin-right:10px;">YES</a>
          <a href="${escapeHtml(noUrl)}" style="display:inline-block;background:#eeeeee;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:999px;">NO</a>
        `,
  });

  return sendTransactionalEmail({
    to: input.participation.email,
    subject,
    html,
    text: `${bodyText}\n\n${laMesaSiteFooterText()}`,
    attachments: [
      {
        name: "invite.ics",
        content: Buffer.from(ics, "utf8").toString("base64"),
      },
    ],
  });
}

export async function sendTemplatedEventEmail(input: {
  key: "participation_confirmed" | "reminder_7d" | "reminder_36h" | "reminder_90m";
  event: AdminEvent;
  participation: AdminEventParticipation;
}): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: true }> {
  if (!(await isEmailTemplateEnabled(input.key, input.event))) {
    return { ok: true, skipped: true };
  }
  const base = getSiteUrl();
  const locale = sendLocaleForEvent(input.event);
  const template = await getEmailTemplate(input.key, input.event, locale);
  const vars = buildEventTemplateVars({
    event: input.event,
    publicBaseUrl: base,
    fullName: input.participation.fullName ?? "",
    email: input.participation.email,
    locale,
  });
  const subject = applyTemplateVars(template.subject, vars);
  const bodyText = applyTemplateVars(template.body, vars);
  const html = wrapLaMesaPlainBody(bodyText, { lang: locale });

  return sendTransactionalEmail({
    to: input.participation.email,
    subject,
    html,
    text: `${bodyText}\n\n${laMesaSiteFooterText()}`,
  });
}
