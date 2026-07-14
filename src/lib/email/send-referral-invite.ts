import { sendTransactionalEmail } from "@/lib/email/send-transactional";

type MailLocale = "fr" | "en" | "es";

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
  sponsorFullName: string,
  inviteUrl: string,
): { subject: string; html: string; text: string } {
  const sponsor = sponsorFullName.trim() || (locale === "en" ? "A friend" : locale === "fr" ? "Un ami" : "Un amigo");

  const copy =
    locale === "en"
      ? {
          subject: `${sponsor} invited you to join LA MESA`,
          greeting: "Hello,",
          concept:
            "LA MESA is a private network of curated professional dinners — small tables, high-signal conversations, no cold networking.",
          invite: `${sponsor} invited you to join LA MESA.`,
          body: "Sign up for free here. You’ll soon receive an invitation to attend a dinner.",
          cta: "Sign up for free",
          footer: "LA MESA — exclusive private dinners.",
        }
      : locale === "es"
        ? {
            subject: `${sponsor} te invita a unirte a LA MESA`,
            greeting: "Estimado/a:",
            concept:
              "LA MESA es una red privada de cenas profesionales selectas: mesas reducidas, conversaciones de alto valor y sin networking superficial.",
            invite: `${sponsor} te ha invitado a unirte a LA MESA.`,
            body: "Regístrate sin costo aquí. Próximamente recibirás una invitación para participar en una cena.",
            cta: "Registrarme sin costo",
            footer: "LA MESA — cenas privadas exclusivas.",
          }
        : {
            subject: `${sponsor} vous a invité à rejoindre LA MESA`,
            greeting: "Bonjour,",
            concept:
              "LA MESA est un réseau privé de dîners professionnels sélectionnés — petites tables, conversations à forte valeur, sans networking froid.",
            invite: `${sponsor} vous a invité à rejoindre LA MESA.`,
            body: "Inscrivez-vous gratuitement ici et recevez prochainement une invitation à participer à un dîner.",
            cta: "S’inscrire gratuitement",
            footer: "LA MESA — dîners privés exclusifs.",
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
          <tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#333;">${escapeHtml(copy.concept)}</td></tr>
          <tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#333;"><strong>${escapeHtml(copy.invite)}</strong></td></tr>
          <tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#333;">${escapeHtml(copy.body)}</td></tr>
          <tr>
            <td style="padding-top:24px;">
              <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#b4e600;color:#111;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;">
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
    copy.concept,
    "",
    copy.invite,
    copy.body,
    "",
    `${copy.cta}: ${inviteUrl}`,
    "",
    copy.footer,
  ].join("\n");

  return { subject: copy.subject, html, text };
}

export async function sendReferralInviteEmail(input: {
  to: string;
  sponsorFullName: string;
  inviteUrl: string;
  locale?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const locale = resolveLocale(input.locale);
  const { subject, html, text } = buildContent(locale, input.sponsorFullName, input.inviteUrl);

  return sendTransactionalEmail({
    to: input.to,
    subject,
    html,
    text,
    bccAdmins: false,
  });
}
