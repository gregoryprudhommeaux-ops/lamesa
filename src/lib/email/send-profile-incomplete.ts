import {
  escapeEmailHtml,
  laMesaSiteFooterText,
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
import {
  currentNudgeMonthKey,
  isProfileIncomplete,
  listMissingProfileFieldsEs,
} from "@/lib/member/profile-completion";
import { getSiteUrl } from "@/lib/site-url";
import type { WaitlistRegistration } from "@/lib/types/events";
import { FieldValue } from "firebase-admin/firestore";

const PROFILE_INCOMPLETE_KEY = "profile_incomplete" as const;

export type ProfileIncompleteMailResult =
  | { ok: true; skipped?: boolean; reason?: string; month?: string }
  | { ok: false; error: string };

function loginUrlCtaHtml(loginUrl: string, bodyText: string): string {
  const TOKEN = "__LM_LOGIN__";
  let prepared = bodyText;
  if (loginUrl) prepared = prepared.split(loginUrl).join(TOKEN);
  let html = escapeEmailHtml(prepared).replace(/\n/g, "<br/>");
  if (loginUrl) {
    html = html.split(TOKEN).join(
      `<a href="${escapeEmailHtml(loginUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;margin:8px 0;">Completar mi perfil</a>`,
    );
  }
  return html;
}

export async function persistProfileIncompleteEmailStatus(
  waitlistId: string,
  mail: ProfileIncompleteMailResult,
  month: string,
): Promise<"sent" | "failed" | "skipped"> {
  const status =
    !mail.ok ? "failed" : "skipped" in mail && mail.skipped ? "skipped" : "sent";
  const now = new Date().toISOString();
  await getAdminFirestore()
    .collection(COLLECTIONS.waitlist)
    .doc(waitlistId)
    .set(
      {
        profileIncompleteEmailStatus: status,
        profileIncompleteEmailSentAt: now,
        ...(status === "sent" ? { profileIncompleteNudgeMonth: month } : {}),
        ...(status === "failed" && !mail.ok
          ? { profileIncompleteEmailError: mail.error }
          : { profileIncompleteEmailError: FieldValue.delete() }),
      },
      { merge: true },
    );
  return status;
}

/**
 * Send profile-incomplete nudge (always ES).
 * Skips if template off, profile already 100%, or already nudged this month (unless force).
 */
export async function sendProfileIncompleteEmail(input: {
  member: Pick<
    WaitlistRegistration,
    | "id"
    | "email"
    | "fullName"
    | "phone"
    | "company"
    | "sector"
    | "position"
    | "city"
    | "linkedinUrl"
    | "invitationMotivation"
    | "extraActivities"
    | "canBring"
    | "isSeeking"
    | "source"
    | "profileComplete"
    | "profileIncompleteNudgeMonth"
  >;
  force?: boolean;
  now?: Date;
}): Promise<ProfileIncompleteMailResult> {
  const month = currentNudgeMonthKey(input.now);
  const email = input.member.email?.trim();
  if (!email) {
    return { ok: false, error: "missing_email" };
  }

  if (!isProfileIncomplete(input.member)) {
    return { ok: true, skipped: true, reason: "profile_complete", month };
  }

  if (
    !input.force &&
    input.member.profileIncompleteNudgeMonth === month
  ) {
    return { ok: true, skipped: true, reason: "already_sent_this_month", month };
  }

  if (!(await isEmailTemplateEnabled(PROFILE_INCOMPLETE_KEY))) {
    return { ok: true, skipped: true, reason: "template_disabled", month };
  }

  const locale = "es" as const;
  const loginUrl = `${getSiteUrl()}/${locale}/connexion`;
  const missing = listMissingProfileFieldsEs(input.member);
  const missingFields = missing.length > 0 ? missing.join(", ") : "algunos datos";

  const template = await getEmailTemplate(PROFILE_INCOMPLETE_KEY, null, locale);
  const vars: TemplateVars = {
    fullName: input.member.fullName ?? "",
    email,
    loginUrl,
    missingFields,
    eventTitle: "",
    when: "",
    where: "",
    eventUrl: "",
  };
  const subject = applyTemplateVars(template.subject, vars);
  const bodyText = applyTemplateVars(template.body, vars);
  const html = wrapLaMesaEmailHtml({
    lang: locale,
    bodyHtml: loginUrlCtaHtml(loginUrl, bodyText),
  });

  const result = await sendTransactionalEmail({
    to: email,
    subject,
    html,
    text: `${bodyText}\n\n${laMesaSiteFooterText()}`,
    bccAdmins: false,
  });

  if (input.member.id) {
    await persistProfileIncompleteEmailStatus(input.member.id, result, month);
  }

  if (!result.ok) return result;
  if ("skipped" in result && result.skipped) {
    return { ok: true, skipped: true, reason: "send_skipped", month };
  }
  return { ok: true, month };
}
