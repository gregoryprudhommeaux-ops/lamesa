import { getSiteUrl } from "@/lib/site-url";
import {
  escapeEmailHtml,
  wrapLaMesaEmailHtml,
} from "@/lib/email/la-mesa-email-shell";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  applyTemplateVars,
  getEmailTemplate,
  isEmailTemplateEnabled,
  type TemplateVars,
} from "@/lib/email/templates";
import { COLLECTIONS, getAdminFirestore } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const FN_ANNOUNCEMENT_KEY = "fn_announcement" as const;

function loginUrlCtaHtml(loginUrl: string, bodyText: string): string {
  const TOKEN = "__LM_LOGIN__";
  let prepared = bodyText;
  if (loginUrl) prepared = prepared.split(loginUrl).join(TOKEN);
  let html = escapeEmailHtml(prepared).replace(/\n/g, "<br/>");
  if (loginUrl) {
    html = html.split(TOKEN).join(
      `<a href="${escapeEmailHtml(loginUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;margin:8px 0;">Crear cuenta / iniciar sesión</a>`,
    );
  }
  return html;
}

export type FnAnnouncementMailResult =
  | { ok: true; skipped?: boolean; reason?: string }
  | { ok: false; error: string };

/** Persist FN announcement email outcome on the waitlist doc. */
export async function persistFnAnnouncementEmailStatus(
  waitlistId: string,
  mail: FnAnnouncementMailResult,
): Promise<"sent" | "failed" | "skipped"> {
  const status =
    !mail.ok ? "failed" : "skipped" in mail && mail.skipped ? "skipped" : "sent";
  const now = new Date().toISOString();
  await getAdminFirestore()
    .collection(COLLECTIONS.waitlist)
    .doc(waitlistId)
    .set(
      {
        fnAnnouncementEmailStatus: status,
        fnAnnouncementEmailSentAt: now,
        ...(status === "failed" && !mail.ok
          ? { fnAnnouncementEmailError: mail.error }
          : { fnAnnouncementEmailError: FieldValue.delete() }),
      },
      { merge: true },
    );
  return status;
}

/**
 * Send FrancoNetwork → LA MESA announcement (always Spanish).
 * Skips if template disabled, or if already sent (unless force).
 */
export async function sendFranconetworkAnnouncementEmail(input: {
  to: string;
  fullName: string;
  waitlistId?: string;
  /** Re-send even if status is already "sent" */
  force?: boolean;
  /** Current status on the doc — used for idempotency when waitlistId not loaded */
  alreadySent?: boolean;
}): Promise<FnAnnouncementMailResult> {
  if (!input.force && input.alreadySent) {
    return { ok: true, skipped: true, reason: "already_sent" };
  }

  if (!(await isEmailTemplateEnabled(FN_ANNOUNCEMENT_KEY))) {
    return { ok: true, skipped: true, reason: "template_disabled" };
  }

  const locale = "es" as const;
  const loginUrl = `${getSiteUrl()}/${locale}/connexion`;
  const template = await getEmailTemplate(FN_ANNOUNCEMENT_KEY, null, locale);
  const vars: TemplateVars = {
    fullName: input.fullName,
    email: input.to,
    loginUrl,
    eventTitle: "",
    when: "",
    where: "",
    eventUrl: "",
  };
  const subject = applyTemplateVars(template.subject, vars);
  const bodyText = applyTemplateVars(template.body, vars);
  const html = wrapLaMesaEmailHtml({
    bodyHtml: loginUrlCtaHtml(loginUrl, bodyText),
    lang: locale,
  });

  const result = await sendTransactionalEmail({
    to: input.to,
    subject,
    html,
    text: bodyText,
    bccAdmins: false,
  });

  if (input.waitlistId) {
    await persistFnAnnouncementEmailStatus(input.waitlistId, result);
  }

  return result;
}
