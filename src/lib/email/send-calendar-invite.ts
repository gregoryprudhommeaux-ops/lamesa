import {
  buildCalendarInviteIcs,
  buildGoogleCalendarUrl,
  eventCalendarInviteUid,
  plainTextFromRichMarkers,
} from "@/lib/email/ics";
import { signRsvpToken } from "@/lib/email/rsvp-token";
import { buildRsvpClickUrl } from "@/lib/email/rsvp-links";
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
import { emailPublicBaseUrl } from "@/lib/site-url";
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
 * Hides raw YES/NO URLs (ugly long tokens) and renders short label links.
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

  // Drop “YES: <url>” / “NO: <url>” lines entirely — buttons/footer carry the CTA.
  prepared = prepared
    .replace(/^[ \t]*YES\s*:?\s*__LM_YES__[ \t]*$/gim, "")
    .replace(/^[ \t]*NO\s*:?\s*__LM_NO__[ \t]*$/gim, "")
    .replace(/YES\s*:?\s*__LM_YES__/gi, YES)
    .replace(/NO\s*:?\s*__LM_NO__/gi, NO)
    // Any leftover RSVP go links (escaped or not)
    .replace(/https?:\/\/[^\s<>"]*\/api\/rsvp\/[^\s<>"]+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

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

export function rsvpYesNoButtonsHtml(input: {
  yesUrl: string;
  noUrl: string;
  locale: TemplateLocale;
}): string {
  const yesLabel = input.locale === "es" ? "SÍ" : input.locale === "en" ? "YES" : "OUI";
  const noLabel = "NO";
  const btnYes =
    "display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px;margin:0 8px 10px 0;";
  const btnNo =
    "display:inline-block;background:#eeeeee;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px;margin:0 8px 10px 0;";
  return `
          <div style="margin-top:8px;">
            <a href="${escapeEmailHtml(input.yesUrl)}" style="${btnYes}">${yesLabel}</a>
            <a href="${escapeEmailHtml(input.noUrl)}" style="${btnNo}">${noLabel}</a>
          </div>
        `;
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
      ? "Confirme ta présence par réponse à l’email LA MESA."
      : input.locale === "en"
        ? "Confirm attendance by replying to the LA MESA email."
        : "Confirma tu asistencia respondiendo al email LA MESA.";
  return plainTextFromRichMarkers(
    [`LA MESA — ${input.title}`, input.location, confirmNote, input.eventUrl]
      .filter(Boolean)
      .join("\n"),
  ).slice(0, 1500);
}

/** Same calendar event for every guest (shared UID); only this recipient as ATTENDEE. */
function buildSharedInviteIcsAttachment(input: {
  event: AdminEvent;
  participation: AdminEventParticipation;
  eventUrl: string;
  locale: TemplateLocale;
  /** When set, used instead of venue/address (e.g. neighborhood-only outreach). */
  locationOverride?: string;
}): { name: string; content: string } | null {
  const location =
    input.locationOverride?.trim() ||
    formatEventWhereLine(input.event.venueName, input.event.address);
  const from = brevoFromAddress();
  // ORGANIZER must equal Brevo From or Gmail shows “Unable to load event”.
  const ics = buildCalendarInviteIcs({
    uid: eventCalendarInviteUid(input.event.id),
    title: `LA MESA — ${input.event.title}`,
    description: sharedCalendarDescription({
      title: input.event.title,
      location,
      eventUrl: input.eventUrl,
      locale: input.locale,
    }),
    location,
    startsAt: input.event.startsAt,
    endsAt: input.event.endsAt,
    organizerEmail: from.email,
    organizerName: input.event.organizerName ?? from.name ?? "LA MESA",
    attendeeEmail: input.participation.email,
    attendeeName: input.participation.fullName,
    url: input.eventUrl,
    requestRsvp: false,
  });
  if (ics.length < 80) return null;
  return {
    name: "la-mesa-invite.ics",
    content: Buffer.from(ics, "utf8").toString("base64"),
  };
}

export async function sendPlacesAvailableEmail(input: {
  event: AdminEvent;
  participation: AdminEventParticipation;
  locale?: TemplateLocale;
}): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: true }> {
  if (!(await isEmailTemplateEnabled("places_available", input.event))) {
    return { ok: true, skipped: true };
  }
  const base = emailPublicBaseUrl();
  const token = signRsvpToken({
    participationId: input.participation.id,
    eventId: input.event.id,
    email: input.participation.email,
  });
  const locale = input.locale ?? sendLocaleForEvent(input.event);
  const yesUrl = buildRsvpClickUrl({ token, response: "yes", locale, baseUrl: base });
  const noUrl = buildRsvpClickUrl({ token, response: "no", locale, baseUrl: base });

  const template = await getEmailTemplate("places_available", input.event, locale);
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
  const publicLocation = vars.wherePublic || vars.where;

  const icsAttachment = buildSharedInviteIcsAttachment({
    event: input.event,
    participation: input.participation,
    eventUrl: vars.eventUrl,
    locale,
    locationOverride: publicLocation,
  });

  const html = wrapLaMesaEmailHtml({
    lang: locale,
    bodyHtml: inviteBodyToHtml(bodyText, yesUrl, noUrl, vars.eventUrl),
    footerHtml: rsvpYesNoButtonsHtml({ yesUrl, noUrl, locale }),
  });

  const plainCta =
    locale === "fr"
      ? `OUI : ${yesUrl}\nNO : ${noUrl}`
      : locale === "es"
        ? `SÍ: ${yesUrl}\nNO: ${noUrl}`
        : `YES: ${yesUrl}\nNO: ${noUrl}`;

  return sendTransactionalEmail({
    to: input.participation.email,
    subject,
    html,
    text: `${bodyText.replace(yesUrl, "").replace(noUrl, "").trim()}\n\n${plainCta}\n\n${laMesaEmailFooterText(locale)}`,
    bccAdmins: false,
    ...(icsAttachment ? { attachments: [icsAttachment] } : {}),
  });
}

export async function sendCalendarInviteEmail(input: {
  event: AdminEvent;
  participation: AdminEventParticipation;
  locale?: TemplateLocale;
}): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: true }> {
  if (!(await isEmailTemplateEnabled("calendar_invite", input.event))) {
    return { ok: true, skipped: true };
  }
  const base = emailPublicBaseUrl();
  const token = signRsvpToken({
    participationId: input.participation.id,
    eventId: input.event.id,
    email: input.participation.email,
  });
  const locale = input.locale ?? sendLocaleForEvent(input.event);
  const yesUrl = buildRsvpClickUrl({ token, response: "yes", locale, baseUrl: base });
  const noUrl = buildRsvpClickUrl({ token, response: "no", locale, baseUrl: base });
  const icsDownloadUrl = `${base}/api/invite-ics/${encodeURIComponent(token)}`;

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
  const calendarDescription = sharedCalendarDescription({
    title: input.event.title,
    location,
    eventUrl: vars.eventUrl,
    locale,
  });
  const icsAttachment = buildSharedInviteIcsAttachment({
    event: input.event,
    participation: input.participation,
    eventUrl: vars.eventUrl,
    locale,
  });
  if (!icsAttachment) {
    return { ok: false, error: "ics_build_failed" };
  }

  const googleCalUrl = buildGoogleCalendarUrl({
    title: `LA MESA — ${input.event.title}`,
    description: calendarDescription,
    location,
    startsAt: input.event.startsAt,
    endsAt: input.event.endsAt,
  });

  const btnOutline =
    "display:inline-block;background:#ffffff;color:#111;text-decoration:none;font-weight:700;font-size:13px;padding:10px 16px;border-radius:999px;border:1px solid #cccccc;margin:0 8px 10px 0;";

  const html = wrapLaMesaEmailHtml({
    lang: locale,
    bodyHtml: inviteBodyToHtml(bodyText, yesUrl, noUrl, vars.eventUrl),
    footerHtml: `
          ${rsvpYesNoButtonsHtml({ yesUrl, noUrl, locale })}
          <div style="margin-top:8px;">
            <a href="${escapeEmailHtml(googleCalUrl)}" style="${btnOutline}">${escapeEmailHtml(CALENDAR_CTA[locale])}</a>
            <a href="${escapeEmailHtml(icsDownloadUrl)}" style="${btnOutline}">${escapeEmailHtml(ICS_DOWNLOAD_CTA[locale])}</a>
          </div>
        `,
  });

  return sendTransactionalEmail({
    to: input.participation.email,
    subject,
    html,
    text: `${bodyText}\n\n${CALENDAR_CTA[locale]}: ${googleCalUrl}\n${ICS_DOWNLOAD_CTA[locale]}: ${icsDownloadUrl}\n\n${laMesaEmailFooterText(locale)}`,
    attachments: [icsAttachment],
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
  const base = emailPublicBaseUrl();
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

  const attachments =
    input.key === "payment_relance"
      ? (() => {
          const ics = buildSharedInviteIcsAttachment({
            event: input.event,
            participation: input.participation,
            eventUrl: vars.eventUrl,
            locale,
          });
          return ics ? [ics] : undefined;
        })()
      : undefined;

  return sendTransactionalEmail({
    to: input.participation.email,
    subject,
    html,
    text: `${bodyText}\n\n${laMesaEmailFooterText(locale)}`,
    bccAdmins: false,
    ...(attachments ? { attachments } : {}),
  });
}
