import { COLLECTIONS, getAdminFirestore } from "@/lib/firebase/admin";
import { listProspects } from "@/lib/prospects/store";
import type { ProspectList, ProspectListWithCount } from "@/lib/types/prospect-lists";
import { isSoftDeleted } from "@/lib/member/soft-delete";

function docToList(id: string, data: Record<string, unknown>): ProspectList {
  return {
    id,
    name: String(data.name ?? "").trim(),
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
  };
}

export async function listProspectLists(): Promise<ProspectListWithCount[]> {
  const db = getAdminFirestore();
  const [listsSnap, prospects] = await Promise.all([
    db.collection(COLLECTIONS.prospectLists).orderBy("updatedAt", "desc").limit(200).get(),
    listProspects({ limit: 5000 }),
  ]);

  const fromDocs = listsSnap.docs
    .map((d) => docToList(d.id, d.data() as Record<string, unknown>))
    .filter((l) => l.name);

  const counts = new Map<string, number>();
  for (const p of prospects) {
    for (const raw of p.lists ?? []) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  // Ensure orphan names on contacts still appear in the sidebar
  const byKey = new Map<string, ProspectList>();
  for (const l of fromDocs) {
    byKey.set(l.name.toLowerCase(), l);
  }
  for (const [key, count] of counts) {
    if (byKey.has(key)) continue;
    const name =
      prospects.flatMap((p) => p.lists ?? []).find((n) => n.trim().toLowerCase() === key)?.trim() ??
      key;
    byKey.set(key, {
      id: `orphan:${key}`,
      name,
      createdAt: "",
      updatedAt: "",
    });
    void count;
  }

  return [...byKey.values()]
    .map((l) => ({
      ...l,
      contactCount: counts.get(l.name.toLowerCase()) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function createProspectList(
  nameRaw: string,
): Promise<{ ok: true; list: ProspectList } | { ok: false; error: string }> {
  const name = nameRaw.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) return { ok: false, error: "invalid_name" };

  const existing = await listProspectLists();
  if (existing.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
    const hit = existing.find((l) => l.name.toLowerCase() === name.toLowerCase())!;
    return { ok: true, list: { id: hit.id, name: hit.name, createdAt: hit.createdAt, updatedAt: hit.updatedAt } };
  }

  const now = new Date().toISOString();
  const ref = getAdminFirestore().collection(COLLECTIONS.prospectLists).doc();
  const list: ProspectList = { id: ref.id, name, createdAt: now, updatedAt: now };
  await ref.set({ name, createdAt: now, updatedAt: now });
  return { ok: true, list };
}

export async function renameProspectList(
  id: string,
  nameRaw: string,
): Promise<{ ok: true; list: ProspectList } | { ok: false; error: string }> {
  if (id.startsWith("orphan:")) {
    // Promote orphan name → real doc, then rename via rewrite
    const oldName = id.slice("orphan:".length);
    const created = await createProspectList(oldName);
    if (!created.ok) return created;
    return renameProspectList(created.list.id, nameRaw);
  }

  const name = nameRaw.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) return { ok: false, error: "invalid_name" };

  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.prospectLists).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "not_found" };
  const old = docToList(snap.id, snap.data() as Record<string, unknown>);
  if (old.name.toLowerCase() === name.toLowerCase()) {
    return { ok: true, list: old };
  }

  const now = new Date().toISOString();
  await ref.set({ name, updatedAt: now }, { merge: true });

  // Rewrite membership strings on prospects
  const prospects = await listProspects({ limit: 5000 });
  const oldKey = old.name.toLowerCase();
  const batchSize = 400;
  let pending = db.batch();
  let ops = 0;
  const commitIfNeeded = async (force = false) => {
    if (ops === 0) return;
    if (!force && ops < batchSize) return;
    await pending.commit();
    pending = db.batch();
    ops = 0;
  };

  for (const p of prospects) {
    const lists = p.lists ?? [];
    if (!lists.some((l) => l.toLowerCase() === oldKey)) continue;
    const next = [
      ...new Set(lists.map((l) => (l.toLowerCase() === oldKey ? name : l)).filter(Boolean)),
    ];
    pending.set(
      db.collection(COLLECTIONS.prospects).doc(p.id),
      { lists: next, updatedAt: now },
      { merge: true },
    );
    ops += 1;
    await commitIfNeeded();
  }
  await commitIfNeeded(true);

  return { ok: true, list: { ...old, name, updatedAt: now } };
}

export async function deleteProspectList(
  id: string,
  opts?: { removeFromContacts?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getAdminFirestore();
  let nameKey = "";

  if (id.startsWith("orphan:")) {
    nameKey = id.slice("orphan:".length).toLowerCase();
  } else {
    const ref = db.collection(COLLECTIONS.prospectLists).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: "not_found" };
    nameKey = String(snap.data()?.name ?? "")
      .trim()
      .toLowerCase();
    await ref.delete();
  }

  if (opts?.removeFromContacts !== false && nameKey) {
    const prospects = await listProspects({ limit: 5000 });
    const now = new Date().toISOString();
    let pending = db.batch();
    let ops = 0;
    for (const p of prospects) {
      const lists = p.lists ?? [];
      if (!lists.some((l) => l.toLowerCase() === nameKey)) continue;
      const next = lists.filter((l) => l.toLowerCase() !== nameKey);
      pending.set(
        db.collection(COLLECTIONS.prospects).doc(p.id),
        { lists: next, updatedAt: now },
        { merge: true },
      );
      ops += 1;
      if (ops >= 400) {
        await pending.commit();
        pending = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await pending.commit();
  }

  return { ok: true };
}

/** Soft-delete many prospects (selection). */
export async function softDeleteProspects(ids: string[]): Promise<number> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();
  let n = 0;
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    const batch = db.batch();
    let ops = 0;
    for (const id of chunk) {
      const ref = db.collection(COLLECTIONS.prospects).doc(id);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const data = snap.data() as Record<string, unknown>;
      if (isSoftDeleted({ deletedAt: data.deletedAt as string | null | undefined })) continue;
      batch.set(ref, { deletedAt: now, updatedAt: now }, { merge: true });
      ops += 1;
      n += 1;
    }
    if (ops > 0) await batch.commit();
  }
  return n;
}
