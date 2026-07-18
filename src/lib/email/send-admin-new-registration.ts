import { sendTransactionalEmail } from "@/lib/email/send-transactional";

/** Inbox for every new waitlist signup (full + express). */
export const NEW_REGISTRATION_TO = "gregory.prudhommeaux@gmail.com";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fieldRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-size:13px;font-weight:600;color:#555;width:140px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-size:14px;line-height:1.45;color:#111;">${escapeHtml(value)}</td>
  </tr>`;
}

export type AdminNewRegistrationInput = {
  fullName: string;
  email: string;
  company: string;
  sector: string;
  position: string;
  city: string;
  phone: string;
  linkedinUrl: string;
  locale: string;
  invitationMotivation: string;
  /** Express (/light) vs full registration form */
  variant?: "express" | "full";
  referralCode?: string;
  referredByCode?: string;
};

function buildContent(input: AdminNewRegistrationInput): { subject: string; html: string; text: string } {
  const isExpress = input.variant === "express";
  const kindLabel = isExpress ? "Express" : "Complet";
  const subject = isExpress
    ? `[LA MESA] Nouvel inscrit (express) — ${input.fullName.trim()}`
    : `[LA MESA] Nouvel inscrit — ${input.fullName.trim()}`;

  const rows: string[] = [
    fieldRow("Type", kindLabel),
    fieldRow("Nom", input.fullName),
    fieldRow("Email", input.email),
    fieldRow("Entreprise", input.company),
    fieldRow("Secteur", input.sector),
    fieldRow("Poste", input.position),
    fieldRow("Ville", input.city),
    fieldRow("Téléphone", input.phone),
    fieldRow("LinkedIn", input.linkedinUrl),
    fieldRow("Langue", input.locale),
    fieldRow("Motivation", input.invitationMotivation),
  ];

  if (input.referralCode?.trim()) {
    rows.push(fieldRow("Code parrainage", input.referralCode.trim()));
  }
  if (input.referredByCode?.trim()) {
    rows.push(fieldRow("Parrainé via", input.referredByCode.trim()));
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#0f1210;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1210;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td style="font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#b4e600;">LA MESA</td></tr>
          <tr><td style="padding-top:16px;font-size:18px;font-weight:700;color:#111;">Nouvelle inscription — ${escapeHtml(kindLabel)}</td></tr>
          <tr><td style="padding-top:8px;font-size:14px;color:#555;">Un nouveau profil vient d'être enregistré.</td></tr>
          <tr>
            <td style="padding-top:20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${rows.join("")}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textLines = [
    `Nouvelle inscription (${kindLabel}) — LA MESA`,
    "",
    `Type: ${kindLabel}`,
    `Nom: ${input.fullName}`,
    `Email: ${input.email}`,
    `Entreprise: ${input.company}`,
    `Secteur: ${input.sector}`,
    `Poste: ${input.position}`,
    `Ville: ${input.city}`,
    `Téléphone: ${input.phone}`,
    `LinkedIn: ${input.linkedinUrl}`,
    `Langue: ${input.locale}`,
    `Motivation: ${input.invitationMotivation}`,
  ];

  if (input.referralCode?.trim()) {
    textLines.push(`Code parrainage: ${input.referralCode.trim()}`);
  }
  if (input.referredByCode?.trim()) {
    textLines.push(`Parrainé via: ${input.referredByCode.trim()}`);
  }

  return { subject, html, text: textLines.join("\n") };
}

export async function sendAdminNewRegistrationEmail(
  input: AdminNewRegistrationInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { subject, html, text } = buildContent(input);

  return sendTransactionalEmail({
    to: [NEW_REGISTRATION_TO],
    subject,
    html,
    text,
    bccAdmins: false,
  });
}
