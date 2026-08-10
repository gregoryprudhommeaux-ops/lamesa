import { COLLECTIONS, getAdminFirestore } from "@/lib/firebase/admin";
import {
  mergeProspects,
  normalizeProspectEmail,
  prospectFromInput,
} from "@/lib/prospects/normalize";
import type { Prospect, ProspectInput } from "@/lib/types/prospects";
import { isSoftDeleted } from "@/lib/member/soft-delete";

function docToProspect(id: string, data: Record<string, unknown>): Prospect {
  return {
    id,
    email: String(data.email ?? "").toLowerCase(),
    fullName: String(data.fullName ?? ""),
    company: String(data.company ?? ""),
    position: String(data.position ?? ""),
    sector: String(data.sector ?? ""),
    city: String(data.city ?? ""),
    linkedin: String(data.linkedin ?? ""),
    phone: String(data.phone ?? ""),
    notes: String(data.notes ?? ""),
    tags: Array.isArray(data.tags) ? data.tags.map(String).filter(Boolean) : [],
    lists: Array.isArray(data.lists) ? data.lists.map(String).filter(Boolean) : [],
    status: (data.status as Prospect["status"]) || "to_contact",
    seen: Boolean(data.seen),
    source: String(data.source ?? "manual"),
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
    lastContactedAt:
      typeof data.lastContactedAt === "string" ? data.lastContactedAt : null,
    deletedAt: typeof data.deletedAt === "string" ? data.deletedAt : null,
  };
}

export async function findProspectByEmail(email: string): Promise<Prospect | null> {
  const normalized = normalizeProspectEmail(email);
  if (!normalized.includes("@")) return null;
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.prospects)
    .where("email", "==", normalized)
    .limit(5)
    .get();
  for (const doc of snap.docs) {
    const p = docToProspect(doc.id, doc.data() as Record<string, unknown>);
    if (!isSoftDeleted(p)) return p;
  }
  return null;
}

export async function listProspects(opts?: {
  status?: Prospect["status"];
  list?: string;
  limit?: number;
}): Promise<Prospect[]> {
  const db = getAdminFirestore();
  const limit = Math.min(opts?.limit ?? 2000, 5000);
  const query = db.collection(COLLECTIONS.prospects).orderBy("updatedAt", "desc").limit(limit);
  const snap = await query.get();
  let rows = snap.docs
    .map((d) => docToProspect(d.id, d.data() as Record<string, unknown>))
    .filter((p) => !isSoftDeleted(p));
  if (opts?.status) rows = rows.filter((p) => p.status === opts.status);
  if (opts?.list?.trim()) {
    const name = opts.list.trim().toLowerCase();
    rows = rows.filter((p) => p.lists.some((l) => l.toLowerCase() === name));
  }
  return rows;
}

export async function getProspectById(id: string): Promise<Prospect | null> {
  const snap = await getAdminFirestore().collection(COLLECTIONS.prospects).doc(id).get();
  if (!snap.exists) return null;
  const p = docToProspect(snap.id, snap.data() as Record<string, unknown>);
  if (isSoftDeleted(p)) return null;
  return p;
}

export type UpsertProspectResult =
  | { ok: true; prospect: Prospect; action: "created" | "merged" }
  | { ok: false; error: "email_required" };

/** Create or merge-by-email. Never creates without email. */
export async function upsertProspect(
  input: ProspectInput,
  opts?: { source?: string },
): Promise<UpsertProspectResult> {
  const existing = await findProspectByEmail(input.email);
  const now = new Date().toISOString();
  const built = prospectFromInput(
    { ...input, source: input.source ?? opts?.source ?? "manual" },
    existing ? { existing, now } : { now },
  );
  if ("error" in built) return { ok: false, error: "email_required" };

  const db = getAdminFirestore();
  if (existing) {
    const { id: _id, ...rest } = built;
    await db.collection(COLLECTIONS.prospects).doc(existing.id).set(rest, { merge: true });
    return { ok: true, prospect: { ...built, id: existing.id }, action: "merged" };
  }

  const ref = db.collection(COLLECTIONS.prospects).doc();
  const { id: _id, ...rest } = built;
  await ref.set({ ...rest, id: ref.id });
  return { ok: true, prospect: { ...built, id: ref.id }, action: "created" };
}

export async function updateProspect(
  id: string,
  patch: Partial<ProspectInput> & { status?: Prospect["status"]; notes?: string },
): Promise<Prospect | null> {
  const existing = await getProspectById(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const next = prospectFromInput(
    {
      email: patch.email ?? existing.email,
      fullName: patch.fullName !== undefined ? patch.fullName : existing.fullName,
      company: patch.company !== undefined ? patch.company : existing.company,
      position: patch.position !== undefined ? patch.position : existing.position,
      sector: patch.sector !== undefined ? patch.sector : existing.sector,
      city: patch.city !== undefined ? patch.city : existing.city,
      linkedin: patch.linkedin !== undefined ? patch.linkedin : existing.linkedin,
      phone: patch.phone !== undefined ? patch.phone : existing.phone,
      notes: patch.notes !== undefined ? patch.notes : existing.notes,
      tags: patch.tags ?? existing.tags,
      lists: patch.lists ?? existing.lists,
      status: patch.status ?? existing.status,
      seen: patch.seen !== undefined ? patch.seen : existing.seen,
      source: existing.source,
    },
    { existing, now },
  );
  if ("error" in next) return null;
  const overwritten: Prospect = {
    ...existing,
    ...next,
    fullName: patch.fullName !== undefined ? String(patch.fullName).trim() : existing.fullName,
    company: patch.company !== undefined ? String(patch.company).trim() : next.company,
    position: patch.position !== undefined ? String(patch.position).trim() : next.position,
    sector: patch.sector !== undefined ? String(patch.sector).trim() : next.sector,
    city: patch.city !== undefined ? String(patch.city).trim() : next.city,
    linkedin: patch.linkedin !== undefined ? String(patch.linkedin).trim() : next.linkedin,
    phone: patch.phone !== undefined ? String(patch.phone).trim() : next.phone,
    notes: patch.notes !== undefined ? String(patch.notes).trim() : next.notes,
    tags: patch.tags !== undefined ? patch.tags : existing.tags,
    lists: patch.lists !== undefined ? patch.lists : existing.lists,
    status: patch.status ?? existing.status,
    seen: patch.seen !== undefined ? Boolean(patch.seen) : existing.seen,
    email: patch.email ? normalizeProspectEmail(patch.email) : existing.email,
    updatedAt: now,
  };
  const { id: _i, ...rest } = overwritten;
  await getAdminFirestore().collection(COLLECTIONS.prospects).doc(id).set(rest, { merge: true });
  return overwritten;
}

export async function softDeleteProspect(id: string): Promise<boolean> {
  const existing = await getProspectById(id);
  if (!existing) return false;
  const now = new Date().toISOString();
  await getAdminFirestore().collection(COLLECTIONS.prospects).doc(id).set(
    { deletedAt: now, updatedAt: now },
    { merge: true },
  );
  return true;
}

export async function markProspectsContacted(ids: string[]): Promise<number> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();
  let n = 0;
  const batch = db.batch();
  for (const id of ids) {
    const ref = db.collection(COLLECTIONS.prospects).doc(id);
    batch.set(
      ref,
      { status: "contacted", lastContactedAt: now, updatedAt: now },
      { merge: true },
    );
    n += 1;
  }
  if (n > 0) await batch.commit();
  return n;
}

/** Bulk update status / tags / lists / seen for selected prospects. */
export async function bulkUpdateProspects(input: {
  ids: string[];
  status?: Prospect["status"];
  addTags?: string[];
  addLists?: string[];
  seen?: boolean;
}): Promise<number> {
  const ids = [...new Set(input.ids.filter(Boolean))];
  if (ids.length === 0) return 0;
  const db = getAdminFirestore();
  const now = new Date().toISOString();
  const addTags = (input.addTags ?? []).map((t) => t.trim()).filter(Boolean);
  const addLists = (input.addLists ?? []).map((t) => t.trim()).filter(Boolean);
  let n = 0;

  // Firestore batches max 500
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    const snaps = await Promise.all(
      chunk.map((id) => db.collection(COLLECTIONS.prospects).doc(id).get()),
    );
    const batch = db.batch();
    let batchOps = 0;
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const existing = docToProspect(snap.id, snap.data() as Record<string, unknown>);
      if (isSoftDeleted(existing)) continue;
      const patch: Record<string, unknown> = { updatedAt: now };
      if (input.status) patch.status = input.status;
      if (input.seen !== undefined) patch.seen = input.seen;
      if (addTags.length) {
        patch.tags = [...new Set([...(existing.tags ?? []), ...addTags])];
      }
      if (addLists.length) {
        patch.lists = [...new Set([...(existing.lists ?? []), ...addLists])];
      }
      batch.set(snap.ref, patch, { merge: true });
      batchOps += 1;
      n += 1;
    }
    if (batchOps > 0) await batch.commit();
  }
  return n;
}

export async function mergeProspectDocs(
  keepId: string,
  dropId: string,
): Promise<{ ok: true; prospect: Prospect } | { ok: false; error: string }> {
  if (keepId === dropId) return { ok: false, error: "same_id" };
  const [a, b] = await Promise.all([getProspectById(keepId), getProspectById(dropId)]);
  if (!a || !b) return { ok: false, error: "not_found" };
  const merged = mergeProspects(a, b, keepId);
  const db = getAdminFirestore();
  const { id: _id, ...rest } = merged;
  const now = new Date().toISOString();
  await db.collection(COLLECTIONS.prospects).doc(keepId).set(rest, { merge: true });
  await db.collection(COLLECTIONS.prospects).doc(dropId).set(
    { deletedAt: now, updatedAt: now },
    { merge: true },
  );
  return { ok: true, prospect: merged };
}
