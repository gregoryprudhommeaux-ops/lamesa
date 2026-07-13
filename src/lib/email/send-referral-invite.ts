const RESEND_API = "https://api.resend.com/emails";

type MailLocale = "fr" | "en" | "es";

function fromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "LA MESA <onboarding@resend.dev>"
  );
}

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
  const sponsor = sponsorFullName.trim();

  const copy =
    locale === "en"
      ? {
          subject: `${sponsor || "A LA MESA member"} invites you to join LA MESA`,
          greeting: "Hello,",
          intro: `${sponsor || "A LA MESA member"} thinks you'd be a great fit for LA MESA — exclusive private professional dinners in Guadalajara.`,
          body: "Join the waitlist with their referral link. We'll review your profile and contact you when a seat opens at a curated dinner.",
          cta: "Join the waitlist",
          footer: "LA MESA — exclusive private dinners.",
        }
      : locale === "es"
        ? {
            subject: `${sponsor || "Un miembro de LA MESA"} te invita a unirte a LA MESA`,
            greeting: "Hola,",
            intro: `${sponsor || "Un miembro de LA MESA"} cree que encajarías muy bien en LA MESA — cenas privadas profesionales exclusivas en Guadalajara.`,
            body: "Únete a la lista de espera con su enlace de referido. Revisaremos tu perfil y te contactaremos cuando haya un lugar en una cena seleccionada.",
            cta: "Unirme a la lista de espera",
            footer: "LA MESA — cenas privadas exclusivas.",
          }
        : {
            subject: `${sponsor || "Un membre LA MESA"} t'invite à rejoindre LA MESA`,
            greeting: "Bonjour,",
            intro: `${sponsor || "Un membre LA MESA"} pense que tu serais un excellent profil pour LA MESA — dîners professionnels privés exclusifs à Guadalajara.`,
            body: "Rejoins la liste d'attente avec son lien de parrainage. Nous examinerons ton profil et te contacterons dès qu'une place se libère à un dîner sélectionné.",
            cta: "Rejoindre la liste d'attente",
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
          <tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#333;">${escapeHtml(copy.intro)}</td></tr>
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
    copy.intro,
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
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "resend_not_configured" };

  const locale = resolveLocale(input.locale);
  const { subject, html, text } = buildContent(locale, input.sponsorFullName, input.inviteUrl);

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [input.to],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: detail || `resend_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
