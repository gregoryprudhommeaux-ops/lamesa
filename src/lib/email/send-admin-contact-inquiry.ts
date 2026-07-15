import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import type { ContactInquiryInput } from "@/lib/validation";

/** Inbox for public Questions & partnerships form */
export const CONTACT_INQUIRY_TO = "greg@nextstep-services.com";

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
    <td style="padding:8px 0;font-size:14px;line-height:1.45;color:#111;white-space:pre-wrap;">${escapeHtml(value)}</td>
  </tr>`;
}

const TOPIC_LABEL: Record<ContactInquiryInput["topic"], string> = {
  question: "Question",
  partnership: "Partenariat",
};

export async function sendAdminContactInquiryEmail(
  input: ContactInquiryInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const topicLabel = TOPIC_LABEL[input.topic];
  const subject = `[LA MESA] Contact — ${topicLabel} — ${input.fullName.trim()}`;

  const rows = [
    fieldRow("Sujet", topicLabel),
    fieldRow("Nom", input.fullName),
    fieldRow("Email", input.email),
    fieldRow("Tél / WhatsApp", input.phone),
    fieldRow("Entreprise", input.company?.trim() || "—"),
    fieldRow("Langue", input.locale),
    fieldRow("Message", input.message),
  ];

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#0f1210;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1210;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td style="font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#b4e600;">LA MESA</td></tr>
          <tr><td style="padding-top:16px;font-size:18px;font-weight:700;color:#111;">Nouveau message — Questions & partenariats</td></tr>
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

  const text = [
    "Nouveau message — Questions & partenariats — LA MESA",
    "",
    `Sujet: ${topicLabel}`,
    `Nom: ${input.fullName}`,
    `Email: ${input.email}`,
    `Tél / WhatsApp: ${input.phone}`,
    `Entreprise: ${input.company?.trim() || "—"}`,
    `Langue: ${input.locale}`,
    "",
    "Message:",
    input.message,
  ].join("\n");

  return sendTransactionalEmail({
    to: CONTACT_INQUIRY_TO,
    subject,
    html,
    text,
    bccAdmins: false,
  });
}
