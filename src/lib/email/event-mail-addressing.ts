import { configuredAdminEmails, normalizeEmail } from "@/lib/auth/platform-admin";

/**
 * Personalised event emails stay 1:1 in `to`, with platform admins in `bcc`
 * so invitees never see each other (or the admin copy).
 */
export function eventMailAddressing(to: string): {
  to: string[];
  bcc?: string[];
} {
  const primary = normalizeEmail(to);
  const bcc = configuredAdminEmails().filter((email) => email !== primary);
  return {
    to: [primary],
    ...(bcc.length > 0 ? { bcc } : {}),
  };
}

/** Primary organizing admin (always enrolled on new events). */
export function primaryOrganizerEmail(): string {
  return configuredAdminEmails()[0] ?? "gregory.prudhommeaux@gmail.com";
}
