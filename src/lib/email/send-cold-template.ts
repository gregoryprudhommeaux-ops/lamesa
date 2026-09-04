import {
  laMesaSiteFooterText,
  richTextToEmailHtml,
  wrapLaMesaEmailHtml,
} from "@/lib/email/la-mesa-email-shell";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  applyTemplateVars,
  getEmailTemplate,
  isEmailTemplateEnabled,
} from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/site-url";
import type { EmailTemplateKey, TemplateLocale } from "@/lib/types/events";

export type ColdMailRecipient = {
  id: string;
  fullName: string;
  email: string;
};

export type ColdMailSendResult = {
  contactId: string;
  email: string;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
};

function firstEmail(emails: string[]): string {
  return emails.map((e) => e.trim().toLowerCase()).find((e) => e.includes("@")) ?? "";
}

/**
 * Send a custom (or any) email template to one recipient.
 * Does not BCC admins (campaign volume).
 */
export async function sendColdTemplateEmail(input: {
  templateKey: EmailTemplateKey;
  locale: TemplateLocale;
  to: string;
  fullName: string;
}): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: true; reason: string }> {
  if (!(await isEmailTemplateEnabled(input.templateKey))) {
    return { ok: true, skipped: true, reason: "template_disabled" };
  }

  const email = input.to.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false, error: "invalid_email" };

  const tpl = await getEmailTemplate(input.templateKey, undefined, input.locale);
  const loginUrl = `${getSiteUrl()}/${input.locale === "es" ? "es" : input.locale}/inscription`;
  const vars = {
    fullName: input.fullName.trim() || email,
    email,
    firstName: (input.fullName.trim() || email).split(/\s+/)[0] || email,
    loginUrl,
    inviteUrl: loginUrl,
    eventTitle: "LA MESA",
    when: "",
    where: "Guadalajara",
    eventUrl: loginUrl,
  };

  const subject = applyTemplateVars(tpl.subject, vars);
  const bodyText = applyTemplateVars(tpl.body, vars);
  const html = wrapLaMesaEmailHtml({
    lang: input.locale,
    bodyHtml: richTextToEmailHtml(bodyText),
    includeLegalFooter: false,
  });

  return sendTransactionalEmail({
    to: email,
    subject,
    html,
    text: `${bodyText}\n\n${laMesaSiteFooterText(input.locale)}`,
    bccAdmins: false,
  });
}

export { firstEmail };
