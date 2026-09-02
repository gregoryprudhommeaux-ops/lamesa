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
import { getSiteUrl } from "@/lib/site-url";
import type { AdminEvent, AdminEventParticipation, TemplateLocale } from "@/lib/types/events";

export async function sendSaveTheDateEmail(input: {
  event: AdminEvent;
  participation: AdminEventParticipation;
  locale?: TemplateLocale;
}): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: true }> {
  if (!(await isEmailTemplateEnabled("save_the_date", input.event))) {
    return { ok: true, skipped: true };
  }

  const base = getSiteUrl();
  const locale = input.locale ?? sendLocaleForEvent(input.event);
  const template = await getEmailTemplate("save_the_date", input.event, locale);

  const whereFallback =
    locale === "en"
      ? "Guadalajara centro — venue TBC"
      : locale === "es"
        ? "Centro de Guadalajara — lugar por confirmar"
        : "Centre de Guadalajara — lieu à confirmer";

  const vars = buildEventTemplateVars({
    event: {
      ...input.event,
      venueName: input.event.venueName?.trim() || whereFallback,
    },
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
