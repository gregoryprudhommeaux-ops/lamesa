import { getSiteUrl } from "@/lib/site-url";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";

type MailLocale = "fr" | "en" | "es";
type ConfirmVariant = "full" | "express";

function resolveLocale(raw?: string | null): MailLocale {
  if (raw === "en" || raw === "es" || raw === "fr") return raw;
  return "es";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildContent(
  locale: MailLocale,
  fullName: string,
  variant: ConfirmVariant,
): {
  subject: string;
  html: string;
  text: string;
} {
  const base = getSiteUrl();
  const name = fullName.trim();
  const loginUrl = `${base}/${locale}/connexion`;

  const copy =
    variant === "express"
      ? locale === "en"
        ? {
            subject: "Welcome to LA MESA — complete your profile",
            greeting: name ? `Hello ${name},` : "Hello,",
            thanks:
              "Thanks for your express signup. You’re on the LA MESA waitlist.",
            next: "Sign in with the same email (Google, or email + password you create on the sign-in page) to complete your profile.",
            cta: "Sign in and complete my profile",
            footer: "LA MESA — exclusive private dinners.",
          }
        : locale === "es"
          ? {
              subject: "Bienvenido/a a LA MESA — completa tu perfil",
              greeting: name ? `Estimado/a ${name}:` : "Estimado/a:",
              thanks:
                "Gracias por tu registro express. Ya estás en la lista de espera de LA MESA.",
              next: "Inicia sesión con el mismo correo (Google, o correo + contraseña que crees en la página de acceso) para completar tu perfil.",
              cta: "Iniciar sesión y completar mi perfil",
              footer: "LA MESA — cenas privadas exclusivas.",
            }
          : {
              subject: "Bienvenue chez LA MESA — complète ton profil",
              greeting: name ? `Bonjour ${name},` : "Bonjour,",
              thanks:
                "Merci pour ton inscription express. Tu es bien sur la liste d’attente LA MESA.",
              next: "Connecte-toi avec le même email (Google, ou email + mot de passe créé sur la page de connexion) pour compléter ton profil.",
              cta: "Se connecter et compléter mon profil",
              footer: "LA MESA — dîners privés exclusifs.",
            }
      : locale === "en"
        ? {
            subject: "You're on the LA MESA waitlist",
            greeting: name ? `Hello ${name},` : "Hello,",
            thanks:
              "Thank you for joining the LA MESA waitlist. Your profile has been received.",
            next: "We'll contact you soon to invite you to a curated professional dinner. Sign in with the same email (Google or email + password) anytime to update your profile.",
            cta: "Sign in and edit my profile",
            footer: "LA MESA — exclusive private dinners.",
          }
        : locale === "es"
          ? {
              subject: "Registro en lista de espera — LA MESA",
              greeting: name ? `Estimado/a ${name}:` : "Estimado/a:",
              thanks:
                "Gracias por registrarte en la lista de espera de LA MESA. Hemos recibido tu perfil.",
              next: "Te contactaremos pronto para invitarte a una cena profesional selecta. Inicia sesión con el mismo correo (Google, o correo + contraseña) cuando desees actualizar tu perfil.",
              cta: "Iniciar sesión y editar mi perfil",
              footer: "LA MESA — cenas privadas exclusivas.",
            }
          : {
              subject: "Tu es sur la liste d'attente LA MESA",
              greeting: name ? `Bonjour ${name},` : "Bonjour,",
              thanks:
                "Merci de t'être inscrit(e) à la liste d'attente LA MESA. Ton profil a bien été reçu.",
              next: "Nous te contacterons prochainement pour t'inviter à un dîner professionnel qualifié. Connecte-toi avec le même email (Google, ou email + mot de passe) à tout moment pour modifier ton profil.",
              cta: "Se connecter et modifier mon profil",
              footer: "LA MESA — dîners privés exclusifs.",
            };

  const safeGreeting = escapeHtml(copy.greeting);
  const html = `<!DOCTYPE html>
<html lang="${locale}">
<body style="margin:0;padding:0;background:#0f1210;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1210;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td style="font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#b4e600;">LA MESA</td></tr>
          <tr><td style="padding-top:16px;font-size:18px;font-weight:700;color:#111;">${safeGreeting}</td></tr>
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

export async function sendWaitlistConfirmationEmail(input: {
  to: string;
  fullName: string;
  locale?: string | null;
  variant?: ConfirmVariant;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const locale = resolveLocale(input.locale);
  const { subject, html, text } = buildContent(locale, input.fullName, input.variant ?? "full");

  return sendTransactionalEmail({
    to: input.to,
    subject,
    html,
    text,
    bccAdmins: false,
  });
}
