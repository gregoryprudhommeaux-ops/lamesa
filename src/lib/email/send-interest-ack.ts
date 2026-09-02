import {
  laMesaEmailFooterText,
  wrapLaMesaPlainBody,
} from "@/lib/email/la-mesa-email-shell";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
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
  const bodyText = applyTemplateVars(template.body, vars);
  const html = wrapLaMesaPlainBody(bodyText, { lang: locale });

  return sendTransactionalEmail({
    to: input.email,
    subject,
    html,
    text: `${bodyText}\n\n${laMesaEmailFooterText(locale)}`,
    bccAdmins: false,
  });
}
