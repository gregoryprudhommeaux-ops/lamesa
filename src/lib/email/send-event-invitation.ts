import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  laMesaEmailFooterText,
  wrapLaMesaPlainBody,
} from "@/lib/email/la-mesa-email-shell";

export async function sendEventInvitationEmail(input: {
  to: string;
  subject: string;
  bodyText: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const html = wrapLaMesaPlainBody(input.bodyText, { lang: "es" });

  return sendTransactionalEmail({
    to: input.to,
    subject: input.subject,
    html,
    text: `${input.bodyText}\n\n${laMesaEmailFooterText("es")}`,
  });
}
