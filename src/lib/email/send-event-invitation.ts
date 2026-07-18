import { sendTransactionalEmail } from "@/lib/email/send-transactional";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

export async function sendEventInvitationEmail(input: {
  to: string;
  subject: string;
  bodyText: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f1210;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1210;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td style="font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#b4e600;">LA MESA</td></tr>
          <tr><td style="padding-top:20px;font-size:15px;line-height:1.55;color:#222;">${textToHtml(input.bodyText)}</td></tr>
          <tr><td style="padding-top:28px;font-size:12px;color:#777;">LA MESA · Guadalajara</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendTransactionalEmail({
    to: input.to,
    subject: input.subject,
    html,
    text: input.bodyText,
  });
}
