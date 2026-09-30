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
import { COLLECTIONS, getAdminFirestore } from "@/lib/firebase/admin";
import {
  currentNudgeMonthKey,
  isProfileIncomplete,
  listMissingProfileFieldsEs,
} from "@/lib/member/profile-completion";
import { emailPublicBaseUrl } from "@/lib/site-url";
import type { WaitlistRegistration } from "@/lib/types/events";
import { FieldValue } from "firebase-admin/firestore";

const PROFILE_INCOMPLETE_KEY = "profile_incomplete" as const;

export type ProfileIncompleteMailResult =
  | { ok: true; skipped?: boolean; reason?: string; month?: string }
  | { ok: false; error: string };

export type ProfileIncompletePreview = {
  to: string;
  subject: string;
  body: string;
  loginUrl: string;
  themesUrl: string;
  missingFields: string;
  month: string;
};

type ProfileIncompleteMember = Pick<
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

function profileIncompleteCtaHtml(
  loginUrl: string,
  themesUrl: string,
  bodyText: string,
): string {
  const LOGIN_TOKEN = "__LM_LOGIN__";
  const THEMES_TOKEN = "__LM_THEMES__";
  let prepared = bodyText;
  if (loginUrl) prepared = prepared.split(loginUrl).join(LOGIN_TOKEN);
  if (themesUrl) prepared = prepared.split(themesUrl).join(THEMES_TOKEN);
  let html = escapeEmailHtml(prepared).replace(/\n/g, "<br/>");
  if (loginUrl) {
    html = html.split(LOGIN_TOKEN).join(
      `<a href="${escapeEmailHtml(loginUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;margin:8px 0;">Completar mi perfil</a>`,
    );
  }
  if (themesUrl) {
    html = html.split(THEMES_TOKEN).join(
      `<a href="${escapeEmailHtml(themesUrl)}" style="display:inline-block;background:transparent;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;border:2px solid #111;margin:8px 0;">Elegir mis temas</a>`,
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

/** Build subject/body for the profile-incomplete nudge (always ES). Does not send. */
export async function buildProfileIncompletePreview(input: {
  member: ProfileIncompleteMember;
  now?: Date;
}): Promise<
  | { ok: true; preview: ProfileIncompletePreview }
  | { ok: false; error: string; month?: string }
> {
  const month = currentNudgeMonthKey(input.now);
  const email = input.member.email?.trim();
  if (!email) {
    return { ok: false, error: "missing_email", month };
  }

  if (!isProfileIncomplete(input.member)) {
    return { ok: false, error: "profile_complete", month };
  }

  if (!(await isEmailTemplateEnabled(PROFILE_INCOMPLETE_KEY))) {
    return { ok: false, error: "template_disabled", month };
  }

  const locale = "es" as const;
  const base = emailPublicBaseUrl();
  const loginUrl = `${base}/${locale}/connexion`;
  const themesUrl = `${base}/${locale}/themes`;
  const missing = listMissingProfileFieldsEs(input.member);
  const missingFields = missing.length > 0 ? missing.join(", ") : "algunos datos";

  const template = await getEmailTemplate(PROFILE_INCOMPLETE_KEY, null, locale);
  const vars: TemplateVars = {
    fullName: input.member.fullName ?? "",
    email,
    loginUrl,
    themesUrl,
    missingFields,
    eventTitle: "",
    when: "",
    where: "",
    eventUrl: "",
  };

  return {
    ok: true,
    preview: {
      to: email,
      subject: applyTemplateVars(template.subject, vars),
      body: applyTemplateVars(template.body, vars),
      loginUrl,
      themesUrl,
      missingFields,
      month,
    },
  };
}

/**
 * Send profile-incomplete nudge (always ES).
 * Skips if template off, profile already 100%, or already nudged this month (unless force).
 * Optional subject/body overrides (admin preview edit) replace the rendered template.
 */
export async function sendProfileIncompleteEmail(input: {
  member: ProfileIncompleteMember;
  force?: boolean;
  now?: Date;
  subject?: string;
  body?: string;
}): Promise<ProfileIncompleteMailResult> {
  const month = currentNudgeMonthKey(input.now);
  const email = input.member.email?.trim();
  if (!email) {
    return { ok: false, error: "missing_email" };
  }

  if (!isProfileIncomplete(input.member)) {
    return { ok: true, skipped: true, reason: "profile_complete", month };
  }

  if (!input.force && input.member.profileIncompleteNudgeMonth === month) {
    return { ok: true, skipped: true, reason: "already_sent_this_month", month };
  }

  const customSubject = input.subject?.trim();
  const customBody = input.body?.trim();
  const hasCustom = Boolean(customSubject && customBody);

  let subject: string;
  let bodyText: string;
  let loginUrl: string;
  let themesUrl: string;

  if (hasCustom) {
    const base = emailPublicBaseUrl();
    loginUrl = `${base}/es/connexion`;
    themesUrl = `${base}/es/themes`;
    subject = customSubject!;
    bodyText = customBody!;
  } else {
    const preview = await buildProfileIncompletePreview({
      member: input.member,
      now: input.now,
    });
    if (!preview.ok) {
      if (preview.error === "template_disabled") {
        return { ok: true, skipped: true, reason: "template_disabled", month };
      }
      return { ok: false, error: preview.error };
    }
    subject = preview.preview.subject;
    bodyText = preview.preview.body;
    loginUrl = preview.preview.loginUrl;
    themesUrl = preview.preview.themesUrl;
  }

  const html = wrapLaMesaEmailHtml({
    lang: "es",
    bodyHtml: profileIncompleteCtaHtml(loginUrl, themesUrl, bodyText),
  });

  const result = await sendTransactionalEmail({
    to: email,
    subject,
    html,
    text: `${bodyText}\n\n${laMesaEmailFooterText("es")}`,
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
