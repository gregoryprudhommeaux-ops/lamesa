import {
  escapeEmailHtml,
  laMesaEmailFooterText,
  wrapLaMesaEmailHtml,
} from "@/lib/email/la-mesa-email-shell";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  applyTemplateVars,
  getEmailTemplate,
  isEmailTemplateEnabled,
  type TemplateVars,
} from "@/lib/email/templates";
import {
  computeProfileCompletionPercent,
  listMissingProfileFieldsEs,
  type ProfileCompletionInput,
} from "@/lib/member/profile-completion";
import { COLLECTIONS, getAdminFirestore } from "@/lib/firebase/admin";
import { getSiteUrl } from "@/lib/site-url";
import { FieldValue } from "firebase-admin/firestore";

const FN_ANNOUNCEMENT_KEY = "fn_announcement" as const;

function fnAnnouncementCtaHtml(profileUrl: string, loginUrl: string, bodyText: string): string {
  const PROFILE_TOKEN = "__LM_PROFILE__";
  const LOGIN_TOKEN = "__LM_LOGIN__";
  let prepared = bodyText;
  if (profileUrl) prepared = prepared.split(profileUrl).join(PROFILE_TOKEN);
  if (loginUrl) prepared = prepared.split(loginUrl).join(LOGIN_TOKEN);
  let html = escapeEmailHtml(prepared).replace(/\n/g, "<br/>");
  if (profileUrl) {
    html = html.split(PROFILE_TOKEN).join(
      `<a href="${escapeEmailHtml(profileUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;margin:8px 0;">Ver y editar mi perfil</a>`,
    );
  }
  if (loginUrl) {
    html = html.split(LOGIN_TOKEN).join(
      `<a href="${escapeEmailHtml(loginUrl)}" style="color:#111;text-decoration:underline;">${escapeEmailHtml(loginUrl)}</a>`,
    );
  }
  return html;
}

export function buildFnAnnouncementProfileMatchNote(
  member: ProfileCompletionInput,
): { profilePercent: string; profileMatchNote: string; missingFields: string } {
  const pct = computeProfileCompletionPercent(member);
  const missing = listMissingProfileFieldsEs(member);
  const missingFields = missing.length > 0 ? missing.join(", ") : "algunos datos";
  const profileMatchNote =
    pct >= 100
      ? "Con el perfil al 100%, te invitamos solo cuando una mesa encaje contigo."
      : [
          "Para invitarte a la mesa correcta, el perfil debe estar al 100%.",
          `Hoy falta: ${missingFields}.`,
          "Sin esa información no hacemos match con una mesa calificada y es probable que no recibas invitación.",
        ].join(" ");
  return { profilePercent: String(pct), profileMatchNote, missingFields };
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
  /** Profile fields used for {{profilePercent}} / {{profileMatchNote}} */
  member?: ProfileCompletionInput;
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
  const profileUrl = `${getSiteUrl()}/${locale}/compte`;
  const profileMeta = buildFnAnnouncementProfileMatchNote(input.member ?? { fullName: input.fullName, email: input.to });

  const template = await getEmailTemplate(FN_ANNOUNCEMENT_KEY, null, locale);
  const vars: TemplateVars = {
    fullName: input.fullName,
    email: input.to,
    loginUrl,
    profileUrl,
    profilePercent: profileMeta.profilePercent,
    profileMatchNote: profileMeta.profileMatchNote,
    missingFields: profileMeta.missingFields,
    eventTitle: "",
    when: "",
    where: "",
    eventUrl: "",
  };
  const subject = applyTemplateVars(template.subject, vars);
  const bodyText = applyTemplateVars(template.body, vars);
  const html = wrapLaMesaEmailHtml({
    bodyHtml: fnAnnouncementCtaHtml(profileUrl, loginUrl, bodyText),
    lang: locale,
  });

  const result = await sendTransactionalEmail({
    to: input.to,
    subject,
    html,
    text: `${bodyText}\n\n${laMesaEmailFooterText(locale)}`,
    bccAdmins: false,
  });

  if (input.waitlistId) {
    await persistFnAnnouncementEmailStatus(input.waitlistId, result);
  }

  return result;
}
