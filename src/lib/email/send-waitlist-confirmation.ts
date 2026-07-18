import { getSiteUrl } from "@/lib/site-url";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  applyTemplateVars,
  getEmailTemplate,
  isEmailTemplateEnabled,
  resolveTemplateLocale,
  type TemplateVars,
} from "@/lib/email/templates";
import type { TemplateLocale } from "@/lib/types/events";

type ConfirmVariant = "full" | "express";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(text: string, loginUrl: string, ctaLabel: string): string {
  const TOKEN = "__LM_LOGIN__";
  let prepared = text;
  if (loginUrl) prepared = prepared.split(loginUrl).join(TOKEN);
  let html = escapeHtml(prepared).replace(/\n/g, "<br/>");
  if (loginUrl) {
    html = html.split(TOKEN).join(
      `<a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;margin:8px 0;">${escapeHtml(ctaLabel)}</a>`,
    );
  }
  return html;
}

function buildLegacyFullContent(
  locale: TemplateLocale,
  fullName: string,
  email: string,
): { subject: string; html: string; text: string } {
  const base = getSiteUrl();
  const name = fullName.trim();
  const loginUrl = `${base}/${locale}/connexion`;

  const copy =
    locale === "en"
      ? {
          subject: "You're on the LA MESA waitlist",
          greeting: name ? `Hello ${name},` : "Hello,",
          thanks:
            "Thank you for joining the LA MESA waitlist. Your profile has been received.",
          next: "When a night fits your profile, we’ll send an invitation. Sign in with the same email (Google or email + password) anytime to update your profile.",
          cta: "Sign in and edit my profile",
          footer: "LA MESA · Guadalajara",
        }
      : locale === "es"
        ? {
            subject: "Registro en lista de espera — LA MESA",
            greeting: name ? `Hola ${name},` : "Hola,",
            thanks:
              "Gracias por registrarte en la lista de LA MESA. Recibimos tu perfil.",
            next: "Cuando una noche encaje con tu perfil, te mandamos una invitación. Inicia sesión con el mismo correo (Google, o correo + contraseña) cuando quieras actualizar tu perfil.",
            cta: "Iniciar sesión y editar mi perfil",
            footer: "LA MESA · Guadalajara",
          }
        : {
            subject: "Tu es sur la liste d'attente LA MESA",
            greeting: name ? `Bonjour ${name},` : "Bonjour,",
            thanks:
              "Merci de t'être inscrit(e) à la liste LA MESA. On a bien reçu ton profil.",
            next: "Quand une soirée colle à ton profil, on t’envoie une invitation. Connecte-toi avec le même email (Google, ou email + mot de passe) quand tu veux modifier ton profil.",
            cta: "Se connecter et modifier mon profil",
            footer: "LA MESA · Guadalajara",
          };

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<body style="margin:0;padding:0;background:#0f1210;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1210;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td style="font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#b4e600;">LA MESA</td></tr>
          <tr><td style="padding-top:16px;font-size:18px;font-weight:700;color:#111;">${escapeHtml(copy.greeting)}</td></tr>
          <tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#333;">${escapeHtml(copy.thanks)}</td></tr>
          <tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#333;">${escapeHtml(copy.next)}</td></tr>
          <tr>
            <td style="padding-top:24px;">
              <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;">
                ${escapeHtml(copy.cta)}
              </a>
            </td>
          </tr>
          <tr><td style="padding-top:28px;font-size:12px;color:#777;">${escapeHtml(copy.footer)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    copy.greeting,
    "",
    copy.thanks,
    copy.next,
    "",
    `${copy.cta}: ${loginUrl}`,
    "",
    copy.footer,
  ].join("\n");

  return { subject: copy.subject, html, text };
}

async function buildExpressFromTemplate(input: {
  fullName: string;
  email: string;
  locale: TemplateLocale;
}): Promise<{ subject: string; html: string; text: string }> {
  const locale = input.locale;
  const loginUrl = `${getSiteUrl()}/${locale}/connexion`;
  const template = await getEmailTemplate("light_signup", null, locale);
  const vars: TemplateVars = {
    fullName: input.fullName,
    email: input.email,
    loginUrl,
    eventTitle: "",
    when: "",
    where: "",
    eventUrl: "",
  };
  const subject = applyTemplateVars(template.subject, vars);
  const bodyText = applyTemplateVars(template.body, vars);
  const ctaLabel =
    locale === "fr"
      ? "Se connecter et compléter mon profil"
      : locale === "en"
        ? "Sign in and complete my profile"
        : "Iniciar sesión y completar mi perfil";
  const bodyHtml = textToHtml(bodyText, loginUrl, ctaLabel);

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<body style="margin:0;padding:0;background:#0f1210;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1210;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td style="font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#b4e600;">LA MESA</td></tr>
          <tr><td style="padding-top:16px;font-size:15px;line-height:1.55;color:#333;">${bodyHtml}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text: bodyText };
}

export async function sendWaitlistConfirmationEmail(input: {
  to: string;
  fullName: string;
  locale?: string | null;
  variant?: ConfirmVariant;
}): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: true }> {
  const variant = input.variant ?? "full";
  const locale =
    variant === "express" ? "es" : resolveTemplateLocale(input.locale);

  if (variant === "express" && !(await isEmailTemplateEnabled("light_signup"))) {
    return { ok: true, skipped: true };
  }

  const { subject, html, text } =
    variant === "express"
      ? await buildExpressFromTemplate({
          fullName: input.fullName,
          email: input.to,
          locale,
        })
      : buildLegacyFullContent(locale, input.fullName, input.to);

  return sendTransactionalEmail({
    to: input.to,
    subject,
    html,
    text,
    bccAdmins: false,
  });
}
