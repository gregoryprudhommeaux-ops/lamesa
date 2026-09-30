import { sendTransactionalEmail } from "@/lib/email/send-transactional";

/** Inbox when someone answers OUI (RSVP bouton or intérêt STD). */
export const RSVP_YES_NOTIFY_TO = "gregory.prudhommeaux@gmail.com";

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
    <td style="padding:8px 0;font-size:14px;line-height:1.45;color:#111;">${escapeHtml(value || "—")}</td>
  </tr>`;
}

export type AdminRsvpYesNotifyInput = {
  fullName: string;
  email: string;
  company?: string | null;
  phone?: string | null;
  eventTitle: string;
  eventSlug?: string | null;
  /** RSVP bouton email vs formulaire intérêt STD */
  channel: "rsvp_button" | "interest_form";
  status?: string | null;
};

/** @internal exported for unit tests */
export function buildAdminRsvpYesNotifyContent(input: AdminRsvpYesNotifyInput): {
  subject: string;
  html: string;
  text: string;
} {
  const name = input.fullName.trim() || input.email.trim();
  const channelLabel =
    input.channel === "interest_form" ? "Formulaire intérêt" : "Bouton RSVP email";
  const subject = `[LA MESA] OUI — ${name} · ${input.eventTitle.trim() || "événement"}`;

  const rows = [
    fieldRow("Réponse", "OUI"),
    fieldRow("Canal", channelLabel),
    fieldRow("Événement", input.eventTitle),
    ...(input.eventSlug?.trim() ? [fieldRow("Slug", input.eventSlug.trim())] : []),
    fieldRow("Nom", input.fullName),
    fieldRow("Email", input.email),
    fieldRow("Entreprise", input.company?.trim() || ""),
    fieldRow("Téléphone", input.phone?.trim() || ""),
    ...(input.status?.trim() ? [fieldRow("Statut place", input.status.trim())] : []),
  ];

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#0f1210;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1210;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td style="font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#b4e600;">LA MESA</td></tr>
          <tr><td style="padding-top:16px;font-size:18px;font-weight:700;color:#111;">Nouveau OUI</td></tr>
          <tr><td style="padding-top:8px;font-size:14px;color:#555;">Quelqu'un vient de répondre OUI.</td></tr>
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
    "Nouveau OUI — LA MESA",
    "",
    `Canal: ${channelLabel}`,
    `Événement: ${input.eventTitle}`,
    ...(input.eventSlug?.trim() ? [`Slug: ${input.eventSlug.trim()}`] : []),
    `Nom: ${input.fullName}`,
    `Email: ${input.email}`,
    `Entreprise: ${input.company?.trim() || "—"}`,
    `Téléphone: ${input.phone?.trim() || "—"}`,
    ...(input.status?.trim() ? [`Statut place: ${input.status.trim()}`] : []),
  ].join("\n");

  return { subject, html, text };
}

export async function sendAdminRsvpYesEmail(
  input: AdminRsvpYesNotifyInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { subject, html, text } = buildAdminRsvpYesNotifyContent(input);

  return sendTransactionalEmail({
    to: [RSVP_YES_NOTIFY_TO],
    subject,
    html,
    text,
    bccAdmins: false,
  });
}
