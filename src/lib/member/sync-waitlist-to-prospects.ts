import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { createProspectList, listProspectLists } from "@/lib/prospects/lists-store";
import {
  findProspectByEmail,
  listProspects,
  updateProspect,
  upsertProspect,
} from "@/lib/prospects/store";
import type { WaitlistRegistration } from "@/lib/types/events";
import type { ProspectStatus } from "@/lib/types/prospects";

/** Playlist CRM pour les membres inscrits (admin MEMBRES). */
export const MEMBRES_INSCRITS_LIST = "MEMBRES INSCRITS";

/** Ancien nom — migré vers MEMBRES INSCRITS. */
const LEGACY_INSCRITS_LIST = "Inscrits";

/** @deprecated use MEMBRES_INSCRITS_LIST */
export const INSCRITS_PROSPECT_LIST = MEMBRES_INSCRITS_LIST;

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

function uniqStrings(values: string[]): string[] {
  return [...new Set(values.map((t) => t.trim()).filter(Boolean))];
}

function prefer(incoming: string | undefined, existing: string | undefined): string {
  const i = (incoming ?? "").trim();
  if (i) return i;
  return (existing ?? "").trim();
}

function withMembresInscritsList(existingLists: string[] | undefined): string[] {
  const legacyKey = LEGACY_INSCRITS_LIST.toLowerCase();
  const withoutLegacy = (existingLists ?? []).filter((l) => l.trim().toLowerCase() !== legacyKey);
  return uniqStrings([...withoutLegacy, MEMBRES_INSCRITS_LIST]);
}

/**
 * Soft sync: never throws. Registration must succeed even if Prospects CRM fails.
 * Upserts by email, merges fields/lists, status won (unless do_not_contact).
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
    await createProspectList(MEMBRES_INSCRITS_LIST);

    const existing = await findProspectByEmail(email);
    const status: ProspectStatus | undefined =
      existing?.status === "do_not_contact" ? undefined : "won";
    const source = member.source?.trim() || "waitlist-registration";

    if (existing) {
      const updated = await updateProspect(existing.id, {
        fullName: prefer(member.fullName, existing.fullName),
        company: prefer(member.company, existing.company),
        position: prefer(member.position, existing.position),
        sector: prefer(member.sector, existing.sector),
        city: prefer(member.city, existing.city),
        phone: prefer(member.phone, existing.phone),
        linkedin: prefer(member.linkedinUrl, existing.linkedin),
        lists: withMembresInscritsList(existing.lists),
        tags: uniqStrings([...(existing.tags ?? []), "inscrit", ...(member.tags ?? [])]),
        ...(status ? { status } : {}),
      });
      if (!updated) {
        console.warn(`${logPrefix} update failed`, email);
        return { ok: false };
      }
      return { ok: true, action: "merged" };
    }

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
        lists: [MEMBRES_INSCRITS_LIST],
        tags: uniqStrings(["inscrit", ...(member.tags ?? [])]),
        status: "won",
        source,
      },
      { source },
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

/** Rename legacy « Inscrits » list doc + memberships → MEMBRES INSCRITS. */
async function migrateLegacyInscritsListName(logPrefix: string): Promise<void> {
  await createProspectList(MEMBRES_INSCRITS_LIST);

  const lists = await listProspectLists();
  const legacy = lists.find((l) => l.name.trim().toLowerCase() === LEGACY_INSCRITS_LIST.toLowerCase());
  if (legacy && !legacy.id.startsWith("orphan:")) {
    const db = getAdminFirestore();
    await db.collection(COLLECTIONS.prospectLists).doc(legacy.id).delete().catch(() => undefined);
  }

  const prospects = await listProspects({ limit: 5000 });
  const legacyKey = LEGACY_INSCRITS_LIST.toLowerCase();
  const now = new Date().toISOString();
  const db = getAdminFirestore();
  let batch = db.batch();
  let ops = 0;

  for (const p of prospects) {
    const listsOn = p.lists ?? [];
    if (!listsOn.some((l) => l.trim().toLowerCase() === legacyKey)) continue;
    const next = withMembresInscritsList(listsOn);
    batch.set(
      db.collection(COLLECTIONS.prospects).doc(p.id),
      { lists: next, updatedAt: now },
      { merge: true },
    );
    ops += 1;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  console.info(`${logPrefix} migrated legacy list « ${LEGACY_INSCRITS_LIST} » → « ${MEMBRES_INSCRITS_LIST} »`);
}

/** One-shot / admin backfill: waitlist → Prospects + liste MEMBRES INSCRITS. */
export async function syncAllWaitlistToProspects(opts?: {
  limit?: number;
  /** If set, only sync these emails (normalized). */
  emails?: string[];
  logPrefix?: string;
}): Promise<{
  ok: boolean;
  scanned: number;
  created: number;
  merged: number;
  skipped: number;
  failed: number;
  listName: string;
}> {
  const logPrefix = opts?.logPrefix ?? "[prospects-sync-all]";
  const limit = Math.min(Math.max(opts?.limit ?? 5000, 1), 8000);
  const emailFilter = opts?.emails?.length
    ? new Set(opts.emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))
    : null;

  if (!isFirebaseAdminConfigured()) {
    return {
      ok: false,
      scanned: 0,
      created: 0,
      merged: 0,
      skipped: 0,
      failed: 0,
      listName: MEMBRES_INSCRITS_LIST,
    };
  }

  await migrateLegacyInscritsListName(logPrefix);
  await createProspectList(MEMBRES_INSCRITS_LIST);

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
    const email = (row.email ?? "").trim().toLowerCase();
    if (emailFilter && !emailFilter.has(email)) continue;

    scanned += 1;
    const result = await syncWaitlistMemberToProspects(row, logPrefix);
    if (result.skipped) skipped += 1;
    else if (!result.ok) failed += 1;
    else if (result.action === "created") created += 1;
    else if (result.action === "merged") merged += 1;
  }

  return {
    ok: true,
    scanned,
    created,
    merged,
    skipped,
    failed,
    listName: MEMBRES_INSCRITS_LIST,
  };
}
