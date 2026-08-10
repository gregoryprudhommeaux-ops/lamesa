import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { createProspectList } from "@/lib/prospects/lists-store";
import { findProspectByEmail, upsertProspect } from "@/lib/prospects/store";
import type { WaitlistRegistration } from "@/lib/types/events";
import type { ProspectStatus } from "@/lib/types/prospects";

/** Playlist CRM pour les membres déjà inscrits sur la plateforme. */
export const INSCRITS_PROSPECT_LIST = "Inscrits";

export type WaitlistProspectSyncInput = Pick<
  WaitlistRegistration,
  | "fullName"
  | "email"
  | "phone"
  | "company"
  | "sector"
  | "position"
  | "city"
  | "linkedinUrl"
  | "source"
  | "tags"
>;

/**
 * Soft sync: never throws. Registration must succeed even if Prospects CRM fails.
 * Creates/ensures list « Inscrits », upserts by email, status won (unless do_not_contact).
 */
export async function syncWaitlistMemberToProspects(
  member: WaitlistProspectSyncInput,
  logPrefix = "[prospects-sync]",
): Promise<{ ok: boolean; action?: "created" | "merged"; skipped?: boolean }> {
  if (!isFirebaseAdminConfigured()) {
    return { ok: false, skipped: true };
  }

  const email = member.email?.trim() ?? "";
  if (!email.includes("@")) {
    console.warn(`${logPrefix} skip — missing email`);
    return { ok: false, skipped: true };
  }

  try {
    await createProspectList(INSCRITS_PROSPECT_LIST);

    const existing = await findProspectByEmail(email);
    const status: ProspectStatus | undefined =
      existing?.status === "do_not_contact" ? undefined : "won";

    const result = await upsertProspect(
      {
        email,
        fullName: member.fullName,
        company: member.company,
        position: member.position,
        sector: member.sector,
        city: member.city,
        phone: member.phone,
        linkedin: member.linkedinUrl,
        lists: [INSCRITS_PROSPECT_LIST],
        tags: ["inscrit", ...(member.tags ?? [])],
        ...(status ? { status } : {}),
        source: member.source?.trim() || "waitlist-registration",
      },
      { source: member.source?.trim() || "waitlist-registration" },
    );

    if (!result.ok) {
      console.warn(`${logPrefix} upsert failed`, result.error);
      return { ok: false };
    }
    return { ok: true, action: result.action };
  } catch (error) {
    console.error(`${logPrefix} upsert failed:`, error);
    return { ok: false };
  }
}

/** One-shot backfill: all active waitlist → Prospects + list Inscrits. */
export async function syncAllWaitlistToProspects(opts?: {
  limit?: number;
  logPrefix?: string;
}): Promise<{
  ok: boolean;
  scanned: number;
  created: number;
  merged: number;
  skipped: number;
  failed: number;
}> {
  const logPrefix = opts?.logPrefix ?? "[prospects-sync-all]";
  const limit = Math.min(Math.max(opts?.limit ?? 5000, 1), 8000);

  if (!isFirebaseAdminConfigured()) {
    return { ok: false, scanned: 0, created: 0, merged: 0, skipped: 0, failed: 0 };
  }

  await createProspectList(INSCRITS_PROSPECT_LIST);

  const snap = await getAdminFirestore().collection(COLLECTIONS.waitlist).limit(limit).get();
  let created = 0;
  let merged = 0;
  let skipped = 0;
  let failed = 0;
  let scanned = 0;

  for (const doc of snap.docs) {
    const row = { id: doc.id, ...(doc.data() as Omit<WaitlistRegistration, "id">) };
    if (isSoftDeleted(row)) {
      skipped += 1;
      continue;
    }
    scanned += 1;
    const result = await syncWaitlistMemberToProspects(row, logPrefix);
    if (result.skipped) skipped += 1;
    else if (!result.ok) failed += 1;
    else if (result.action === "created") created += 1;
    else if (result.action === "merged") merged += 1;
  }

  return { ok: true, scanned, created, merged, skipped, failed };
}
