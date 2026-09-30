import { configuredAdminEmails, normalizeEmail } from "@/lib/auth/platform-admin";

/**
 * Optional addressing helper: 1:1 `to`, platform admins in `bcc`.
 * Not applied by default — pass `bccAdmins: true` to `sendTransactionalEmail` when needed.
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
