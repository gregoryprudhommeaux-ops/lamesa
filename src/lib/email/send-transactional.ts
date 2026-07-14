import { eventMailAddressing } from "@/lib/email/event-mail-addressing";

const BREVO_API = "https://api.brevo.com/v3/smtp/email";

export type TransactionalAttachment = {
  /** Filename shown to the recipient */
  name: string;
  /** Base64 content (no data: prefix) */
  content: string;
};

export type SendTransactionalEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Extra BCC beyond admin copies. Defaults include platform admins via eventMailAddressing. */
  bcc?: string[];
  /** When true (default), BCC configured platform admins unless they are already in `to`. */
  bccAdmins?: boolean;
  attachments?: TransactionalAttachment[];
};

function parseFromAddress(raw: string): { name?: string; email: string } {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (m) {
    return { name: m[1]!.trim().replace(/^"|"$/g, ""), email: m[2]!.trim() };
  }
  return { email: trimmed };
}

/** Sender for Brevo — requires a verified sender/domain in the Brevo dashboard. */
export function brevoFromAddress(): { name?: string; email: string } {
  const raw =
    process.env.BREVO_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "LA MESA <noreply@lamesasecreta.com>";
  return parseFromAddress(raw);
}

export function isBrevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim());
}

function toRecipientList(to: string | string[]): Array<{ email: string }> {
  const list = (Array.isArray(to) ? to : [to])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
  return [...new Set(list)].map((email) => ({ email }));
}

/**
 * Send a transactional email via Brevo (Sendinblue).
 * @see https://developers.brevo.com/reference/sendtransacemail
 */
export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "brevo_not_configured" };

  const to = toRecipientList(input.to);
  if (to.length === 0) return { ok: false, error: "no_recipients" };

  const toEmails = new Set(to.map((r) => r.email));
  const bccEmails = new Set<string>();

  if (input.bccAdmins !== false) {
    // Use addressing of the first recipient to derive admin BCCs
    const addressing = eventMailAddressing(to[0]!.email);
    for (const email of addressing.bcc ?? []) {
      if (!toEmails.has(email)) bccEmails.add(email);
    }
  }
  for (const email of input.bcc ?? []) {
    const n = email.trim().toLowerCase();
    if (n.includes("@") && !toEmails.has(n)) bccEmails.add(n);
  }

  const sender = brevoFromAddress();
  const payload: Record<string, unknown> = {
    sender: sender.name ? { name: sender.name, email: sender.email } : { email: sender.email },
    to,
    subject: input.subject,
    htmlContent: input.html,
  };
  if (input.text?.trim()) payload.textContent = input.text;
  if (bccEmails.size > 0) {
    payload.bcc = [...bccEmails].map((email) => ({ email }));
  }
  if (input.attachments?.length) {
    payload.attachment = input.attachments.map((a) => ({
      name: a.name,
      content: a.content,
    }));
  }

  try {
    const res = await fetch(BREVO_API, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: `brevo_${res.status}:${errText.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
