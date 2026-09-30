import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { isAdminProvisionedWaitlistSource } from "@/lib/member/waitlist-legitimacy";
import type { WaitlistRegistration } from "@/lib/types/events";

function normalizeName(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameMatchesKeepList(
  fullName: string | null | undefined,
  keepNameTokenGroups: string[][],
): boolean {
  const name = normalizeName(fullName);
  if (!name) return false;
  return keepNameTokenGroups.some((tokens) =>
    tokens.every((token) => name.includes(normalizeName(token))),
  );
}

export type SoftDeleteAdminStubsOptions = {
  /** Only these sources (default: places-available only). */
  sources?: string[];
  /** Keep stubs whose fullName contains each token group (AND within group). */
  keepNameTokenGroups?: string[][];
  keepEmails?: string[];
  deletedReason?: string;
};

/**
 * Soft-delete waitlist stubs wrongly created by admin email blasts.
 * Idempotent. Never touches completed profiles or keep-list people.
 */
export async function softDeleteAdminProvisionedWaitlistStubs(
  rows: Array<WaitlistRegistration & { id: string }>,
  options?: SoftDeleteAdminStubsOptions,
): Promise<{ revoked: number; kept: number }> {
  if (!isFirebaseAdminConfigured()) return { revoked: 0, kept: 0 };

  const sources = new Set(
    (options?.sources ?? ["la-mesa-places-available"]).map((s) => s.trim().toLowerCase()),
  );
  const keepEmails = new Set(
    (options?.keepEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
  const keepNameTokenGroups = options?.keepNameTokenGroups ?? [];
  const deletedReason =
    options?.deletedReason ?? "admin-blast-auto-inscrit-revoked";

  let kept = 0;
  const targets = rows.filter((r) => {
    if (isSoftDeleted(r) || !r.id) return false;
    if (r.profileComplete === true) return false;
    const source = String(r.source ?? "").trim().toLowerCase();
    if (!sources.has(source) && !isAdminProvisionedWaitlistSource(r.source)) {
      return false;
    }
    if (sources.size > 0 && !sources.has(source)) return false;

    const email = String(r.email ?? "").trim().toLowerCase();
    if (email && keepEmails.has(email)) {
      kept += 1;
      return false;
    }
    if (nameMatchesKeepList(r.fullName, keepNameTokenGroups)) {
      kept += 1;
      return false;
    }
    return true;
  });

  if (targets.length === 0) return { revoked: 0, kept };

  const db = getAdminFirestore();
  const now = new Date().toISOString();
  let revoked = 0;

  for (let i = 0; i < targets.length; i += 450) {
    const chunk = targets.slice(i, i + 450);
    const batch = db.batch();
    for (const row of chunk) {
      batch.set(
        db.collection(COLLECTIONS.waitlist).doc(row.id),
        {
          deletedAt: now,
          updatedAt: now,
          deletedReason,
        },
        { merge: true },
      );
      revoked += 1;
    }
    await batch.commit();
  }

  return { revoked, kept };
}

/** Keep Julian TORRES + Alice MUZELLEC (NON responses) from the places_available blast cleanup. */
export const PLACES_AVAILABLE_AUTO_INSCRIT_KEEP_NAMES: string[][] = [
  ["julian", "torres"],
  ["alice", "muzellec"],
];
