import {
  buildCalendarInviteIcs,
  buildGoogleCalendarUrl,
  eventCalendarInviteUid,
  plainTextFromRichMarkers,
} from "@/lib/email/ics";
import { signRsvpToken } from "@/lib/email/rsvp-token";
import { primaryOrganizerEmail } from "@/lib/email/event-mail-addressing";
import { brevoFromAddress, sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  applyTemplateVars,
  buildEventTemplateVars,
  getEmailTemplate,
  isEmailTemplateEnabled,
  sendLocaleForEvent,
} from "@/lib/email/templates";
import {
  escapeEmailHtml,
  laMesaEmailFooterText,
  richTextToEmailHtml,
  wrapLaMesaEmailHtml,
  wrapLaMesaPlainBody,
} from "@/lib/email/la-mesa-email-shell";
import { formatEventWhereLine } from "@/lib/events/format-where";
import { getSiteUrl } from "@/lib/site-url";
import type { AdminEvent, AdminEventParticipation, TemplateLocale } from "@/lib/types/events";

const CALENDAR_CTA: Record<TemplateLocale, string> = {
  fr: "Ajouter à Google Calendar",
  es: "Añadir a Google Calendar",
  en: "Add to Google Calendar",
};

const ICS_DOWNLOAD_CTA: Record<TemplateLocale, string> = {
  fr: "Télécharger .ics (rappels J-7 · H-36 · H-1h30)",
  es: "Descargar .ics (recordatorios J-7 · H-36 · H-1h30)",
  en: "Download .ics (reminders D-7 · H-36 · H-1.5)",
};

/**
 * Formal invite body → HTML.
 * Same rich markers as test emails (`<bold>`, links, …), plus YES/NO/event short links.
 */
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

  // Same pipeline as wrapLaMesaPlainBody / send-test (maps <bold> → <b>, etc.)
  let html = richTextToEmailHtml(prepared);

  const linkStyle =
    "color:#111111;font-weight:800;text-decoration:underline;letter-spacing:0.04em;";
  html = html
    .split(YES)
    .join(`<a href="${escapeEmailHtml(yesUrl)}" style="${linkStyle}">YES</a>`)
    .split(NO)
    .join(`<a href="${escapeEmailHtml(noUrl)}" style="${linkStyle}">NO</a>`)
    .split(EVENT)
    .join(
      `<a href="${escapeEmailHtml(eventUrl)}" style="color:#2a6f2b;font-weight:600;text-decoration:underline;">${escapeEmailHtml(eventUrl)}</a>`,
    );

  return html;
}

/** Shared ICS description (no guest-specific roster). */
function sharedCalendarDescription(input: {
  title: string;
  location: string;
  eventUrl: string;
  locale: TemplateLocale;
}): string {
  const confirmNote =
    input.locale === "fr"
      ? "Confirme ta présence avec les boutons YES / NO de l’email LA MESA (pas le Oui du calendrier)."
      : input.locale === "en"
        ? "Confirm attendance with the YES / NO buttons in the LA MESA email (not the calendar Yes)."
        : "Confirma tu asistencia con los botones YES / NO del email LA MESA (no el Sí del calendario).";
  return plainTextFromRichMarkers(
    [`LA MESA — ${input.title}`, input.location, confirmNote, input.eventUrl]
      .filter(Boolean)
      .join("\n"),
  ).slice(0, 1500);
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
  const icsDownloadUrl = `${base}/api/invite-ics/${encoded}`;

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

  const location = formatEventWhereLine(input.event.venueName, input.event.address);
  const from = brevoFromAddress();
  // Calendar replies must not target Brevo From (often nextstep-services.com with no RSVP inbox).
  const organizerEmail = primaryOrganizerEmail();
  const calendarDescription = sharedCalendarDescription({
    title: input.event.title,
    location,
    eventUrl: vars.eventUrl,
    locale,
  });
  const ics = buildCalendarInviteIcs({
    uid: eventCalendarInviteUid(input.event.id),
    title: `LA MESA — ${input.event.title}`,
    description: calendarDescription,
    location,
    startsAt: input.event.startsAt,
    endsAt: input.event.endsAt,
    organizerEmail,
    organizerName: input.event.organizerName ?? from.name ?? "LA MESA",
    sentByEmail: from.email,
    // Only this guest — co-guests must never appear in the ICS (privacy).
    attendeeEmail: input.participation.email,
    attendeeName: input.participation.fullName,
    url: vars.eventUrl,
    // Avoid Google “wasn't able to send your request to nextstep-services.com”.
    requestRsvp: false,
  });

  const googleCalUrl = buildGoogleCalendarUrl({
    title: `LA MESA — ${input.event.title}`,
    description: calendarDescription,
    location,
    startsAt: input.event.startsAt,
    endsAt: input.event.endsAt,
  });

  const btnPrimary =
    "display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:999px;margin:0 8px 10px 0;";
  const btnSecondary =
    "display:inline-block;background:#eeeeee;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:999px;margin:0 8px 10px 0;";
  const btnOutline =
    "display:inline-block;background:#ffffff;color:#111;text-decoration:none;font-weight:700;font-size:13px;padding:10px 16px;border-radius:999px;border:1px solid #cccccc;margin:0 8px 10px 0;";

  const html = wrapLaMesaEmailHtml({
    lang: locale,
    bodyHtml: inviteBodyToHtml(bodyText, yesUrl, noUrl, vars.eventUrl),
    footerHtml: `
          <a href="${escapeEmailHtml(yesUrl)}" style="${btnPrimary}">YES</a>
          <a href="${escapeEmailHtml(noUrl)}" style="${btnSecondary}">NO</a>
          <div style="margin-top:14px;">
            <a href="${escapeEmailHtml(googleCalUrl)}" style="${btnOutline}">${escapeEmailHtml(CALENDAR_CTA[locale])}</a>
            <a href="${escapeEmailHtml(icsDownloadUrl)}" style="${btnOutline}">${escapeEmailHtml(ICS_DOWNLOAD_CTA[locale])}</a>
          </div>
        `,
  });

  const icsBase64 = Buffer.from(ics, "utf8").toString("base64");
  if (!icsBase64 || ics.length < 80) {
    return { ok: false, error: "ics_build_failed" };
  }

  return sendTransactionalEmail({
    to: input.participation.email,
    subject,
    html,
    text: `${bodyText}\n\n${CALENDAR_CTA[locale]}: ${googleCalUrl}\n${ICS_DOWNLOAD_CTA[locale]}: ${icsDownloadUrl}\n\n${laMesaEmailFooterText(locale)}`,
    attachments: [
      {
        name: "la-mesa-invite.ics",
        content: icsBase64,
      },
    ],
    bccAdmins: false,
  });
}

export async function sendTemplatedEventEmail(input: {
  key:
    | "participation_confirmed"
    | "payment_relance"
    | "reminder_7d"
    | "reminder_36h"
    | "reminder_90m";
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
    text: `${bodyText}\n\n${laMesaEmailFooterText(locale)}`,
    bccAdmins: false,
  });
}
