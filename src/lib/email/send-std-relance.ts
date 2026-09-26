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
import type { AdminEvent, TemplateLocale } from "@/lib/types/events";

export async function sendStdRelanceEmail(input: {
  event: AdminEvent;
  email: string;
  fullName?: string | null;
  locale?: TemplateLocale;
}): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: true }> {
  if (!(await isEmailTemplateEnabled("std_relance", input.event))) {
    return { ok: true, skipped: true };
  }

  const base = getSiteUrl();
  const locale = input.locale ?? sendLocaleForEvent(input.event);
  const template = await getEmailTemplate("std_relance", input.event, locale);

  const whereFallback =
    locale === "en"
      ? "Guadalajara centro — venue TBC"
      : locale === "es"
        ? "Centro de Guadalajara — lugar por confirmar"
        : "Centre de Guadalajara — lieu à confirmer";

  const hasWhere =
    Boolean(input.event.venueName?.trim()) || Boolean(input.event.address?.trim());

  const vars = buildEventTemplateVars({
    event: hasWhere ? input.event : { ...input.event, venueName: whereFallback },
    publicBaseUrl: base,
    fullName: input.fullName ?? "",
    email: input.email,
    locale,
  });

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
