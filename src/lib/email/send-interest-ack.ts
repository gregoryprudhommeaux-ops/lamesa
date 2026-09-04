import {
  buildAddToCalendarIcs,
  buildGoogleCalendarUrl,
  plainTextFromRichMarkers,
} from "@/lib/email/ics";
import {
  escapeEmailHtml,
  laMesaEmailFooterText,
  richTextToEmailHtml,
  wrapLaMesaEmailHtml,
  wrapLaMesaPlainBody,
} from "@/lib/email/la-mesa-email-shell";
import { brevoFromAddress, sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  applyTemplateVars,
  buildEventTemplateVars,
  getEmailTemplate,
  isEmailTemplateEnabled,
  sendLocaleForEvent,
} from "@/lib/email/templates";
import { INTEREST_DECLINE_REASONS } from "@/lib/events/event-interest";
import { getSiteUrl } from "@/lib/site-url";
import type {
  AdminEvent,
  EventInterestDeclineReason,
  EventInterestResponse,
  TemplateLocale,
} from "@/lib/types/events";

const INTEREST_ANSWER_LABELS: Record<
  TemplateLocale,
  Record<EventInterestResponse, string>
> = {
  fr: {
    yes: "Oui, intéressé(e)",
    no: "Non, je ne participe pas",
    other: "Autre",
  },
  es: {
    yes: "Sí, me interesa",
    no: "No, no participo",
    other: "Otro",
  },
  en: {
    yes: "Yes, interested",
    no: "No, I won't attend",
    other: "Other",
  },
};

const DECLINE_LABELS: Record<
  TemplateLocale,
  Record<(typeof INTEREST_DECLINE_REASONS)[number], string>
> = {
  fr: {
    too_expensive: "Trop cher",
    not_available: "Pas disponible",
    not_interested_format: "Pas intéressé(e) par le format",
    not_interested_theme: "Pas intéressé(e) par la thématique",
    other: "Autre",
  },
  es: {
    too_expensive: "Demasiado caro",
    not_available: "No disponible",
    not_interested_format: "No me interesa el formato",
    not_interested_theme: "No me interesa la temática",
    other: "Otro",
  },
  en: {
    too_expensive: "Too expensive",
    not_available: "Not available",
    not_interested_format: "Not interested in the format",
    not_interested_theme: "Not interested in the theme",
    other: "Other",
  },
};

const CALENDAR_CTA_LABEL: Record<TemplateLocale, string> = {
  fr: "Ajouter cet événement à mon calendrier",
  es: "Añadir este evento a mi calendario",
  en: "Add this event to my calendar",
};

const CALENDAR_NOTE: Record<TemplateLocale, string> = {
  fr: "Tu peux déjà bloquer la date : ouvre la pièce jointe (.ics) ou utilise le bouton ci-dessous. Le lieu sera précisé avec l’invitation formelle.",
  es: "Ya puedes bloquear la fecha: abre el archivo adjunto (.ics) o usa el botón de abajo. El lugar se precisará con la invitación formal.",
  en: "You can already block the date: open the attached .ics file or use the button below. The venue will be confirmed with the formal invitation.",
};

const LOCATION_TBC: Record<TemplateLocale, string> = {
  fr: "À préciser",
  es: "Por precisar",
  en: "To be confirmed",
};

export function buildInterestSummary(input: {
  locale: TemplateLocale;
  interestResponse: EventInterestResponse;
  declineReason?: EventInterestDeclineReason | null;
  declineReasonOther?: string | null;
  expectations?: string | null;
  ideasComment?: string | null;
}): string {
  const labels = INTEREST_ANSWER_LABELS[input.locale];
  const lines = [`• ${labels[input.interestResponse]}`];

  if (input.interestResponse === "no" && input.declineReason) {
    const reason =
      DECLINE_LABELS[input.locale][input.declineReason] ?? input.declineReason;
    lines.push(
      input.locale === "en"
        ? `• Reason: ${reason}`
        : input.locale === "es"
          ? `• Motivo: ${reason}`
          : `• Motif : ${reason}`,
    );
  }

  const otherText = input.declineReasonOther?.trim();
  if (otherText) {
    lines.push(
      input.locale === "en"
        ? `• Details: ${otherText}`
        : input.locale === "es"
          ? `• Detalle: ${otherText}`
          : `• Précision : ${otherText}`,
    );
  }

  const expectations = input.expectations?.trim();
  if (expectations) {
    lines.push(
      input.locale === "en"
        ? `• Expectations: ${expectations}`
        : input.locale === "es"
          ? `• Expectativas: ${expectations}`
          : `• Attentes : ${expectations}`,
    );
  }

  const ideas = input.ideasComment?.trim();
  if (ideas) {
    lines.push(
      input.locale === "en"
        ? `• Comment: ${ideas}`
        : input.locale === "es"
          ? `• Comentario: ${ideas}`
          : `• Commentaire : ${ideas}`,
    );
  }

  return lines.join("\n");
}

export function interestCalendarTitle(event: AdminEvent): string {
  const custom = event.calendarTitle?.trim();
  if (custom) return custom;
  return `LA MESA | ${event.title.trim()}`;
}

export function interestCalendarDescription(event: AdminEvent): string {
  const intro = event.introText?.trim();
  if (intro) return plainTextFromRichMarkers(intro).slice(0, 1500);
  return plainTextFromRichMarkers(event.title).slice(0, 1500);
}

export async function sendInterestAckEmail(input: {
  event: AdminEvent;
  email: string;
  fullName: string;
  interestResponse: EventInterestResponse;
  declineReason?: EventInterestDeclineReason | null;
  declineReasonOther?: string | null;
  expectations?: string | null;
  ideasComment?: string | null;
  locale?: TemplateLocale;
}): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: true }> {
  if (!(await isEmailTemplateEnabled("interest_ack", input.event))) {
    return { ok: true, skipped: true };
  }

  const base = getSiteUrl();
  const locale = input.locale ?? sendLocaleForEvent(input.event);
  const template = await getEmailTemplate("interest_ack", input.event, locale);
  const addToCalendar = input.interestResponse === "yes";

  const whereFallback =
    locale === "en"
      ? "Guadalajara centro — venue TBC"
      : locale === "es"
        ? "Centro de Guadalajara — lugar por confirmar"
        : "Centre de Guadalajara — lieu à confirmer";

  const vars = {
    ...buildEventTemplateVars({
      event: {
        ...input.event,
        venueName: input.event.venueName?.trim() || whereFallback,
      },
      publicBaseUrl: base,
      fullName: input.fullName,
      email: input.email,
      locale,
    }),
    interestSummary: buildInterestSummary({
      locale,
      interestResponse: input.interestResponse,
      declineReason: input.declineReason,
      declineReasonOther: input.declineReasonOther,
      expectations: input.expectations,
      ideasComment: input.ideasComment,
    }),
  };

  const subject = applyTemplateVars(template.subject, vars);
  let bodyText = applyTemplateVars(template.body, vars);

  const calendarTitle = interestCalendarTitle(input.event);
  const calendarLocation = LOCATION_TBC[locale];
  const calendarDescription = interestCalendarDescription(input.event);
  const googleCalUrl = addToCalendar
    ? buildGoogleCalendarUrl({
        title: calendarTitle,
        description: calendarDescription,
        location: calendarLocation,
        startsAt: input.event.startsAt,
        endsAt: input.event.endsAt,
      })
    : null;

  if (addToCalendar && googleCalUrl) {
    bodyText = `${bodyText}\n\n${CALENDAR_NOTE[locale]}\n${googleCalUrl}`;
  }

  const html =
    addToCalendar && googleCalUrl
      ? wrapLaMesaEmailHtml({
          lang: locale,
          bodyHtml: richTextToEmailHtml(
            bodyText.replace(googleCalUrl, "").replace(/\n{3,}/g, "\n\n").trimEnd(),
          ),
          footerHtml: `<a href="${escapeEmailHtml(googleCalUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:999px;">${escapeEmailHtml(CALENDAR_CTA_LABEL[locale])}</a>`,
        })
      : wrapLaMesaPlainBody(bodyText, { lang: locale });

  const from = brevoFromAddress();
  const attachments = addToCalendar
    ? [
        {
          name: "la-mesa-save-the-date.ics",
          content: Buffer.from(
            buildAddToCalendarIcs({
              uid: `interest-${input.event.id}-${input.email.toLowerCase()}@lamesa`,
              title: calendarTitle,
              description: calendarDescription,
              location: calendarLocation,
              startsAt: input.event.startsAt,
              endsAt: input.event.endsAt,
              organizerEmail: from.email,
              organizerName: input.event.organizerName ?? from.name ?? "LA MESA",
              url: vars.eventUrl,
            }),
            "utf8",
          ).toString("base64"),
        },
      ]
    : undefined;

  return sendTransactionalEmail({
    to: input.email,
    subject,
    html,
    text: `${bodyText}\n\n${laMesaEmailFooterText(locale)}`,
    attachments,
    bccAdmins: false,
  });
}
