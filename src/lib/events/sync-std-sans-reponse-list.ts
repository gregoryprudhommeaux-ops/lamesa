import {
  computeInterestRsvpEmailSets,
  isStdListForEvent,
  type RsvpProspectSlice,
} from "@/lib/admin/next-event-rsvp";
import {
  interestSansReponseListName,
} from "@/lib/events/interest-prospect-lists";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { createProspectList } from "@/lib/prospects/lists-store";
import { findProspectByEmail, listProspects, updateProspect } from "@/lib/prospects/store";
import type { EventRespondent } from "@/lib/types/events";

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

function uniqStrings(values: string[]): string[] {
  return [...new Set(values.map((t) => t.trim()).filter(Boolean))];
}

/**
 * Keep `STD {slug} — SANS RÉPONSE` aligned with dashboard « sans réponse ».
 * Source of truth: computeInterestRsvpEmailSets (contactés − OUI/NON/autre).
 */
export async function syncStdSansReponseList(input: {
  eventSlug: string;
  eventId: string;
  respondents?: EventRespondent[];
  prospects?: RsvpProspectSlice[];
}): Promise<{ added: number; removed: number; total: number; listName: string }> {
  const eventSlug = input.eventSlug.trim();
  const eventId = input.eventId.trim();
  const listName = interestSansReponseListName(eventSlug);

  if (!eventSlug || !eventId || !isFirebaseAdminConfigured()) {
    return { added: 0, removed: 0, total: 0, listName };
  }

  await createProspectList(listName);

  let respondents = input.respondents;
  if (!respondents) {
    const db = getAdminFirestore();
    const snap = await db
      .collection(COLLECTIONS.respondents)
      .where("eventId", "==", eventId)
      .limit(500)
      .get();
    respondents = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<EventRespondent, "id">),
    }));
  }

  let prospects = input.prospects;
  if (!prospects) {
    const all = await listProspects({ limit: 5000 });
    prospects = all.filter((p) =>
      (p.lists ?? []).some((l) => isStdListForEvent(l, eventSlug)),
    );
  }

  const sets = computeInterestRsvpEmailSets({
    eventSlug,
    eventId,
    respondents,
    prospects,
  });

  const pendingEmails = sets.pendingEmails;
  const listKey = listName.toLowerCase();
  let added = 0;
  let removed = 0;

  const scanned = await listProspects({ list: listName, limit: 5000 });
  const scannedIds = new Set(scanned.map((p) => p.id));

  for (const email of pendingEmails) {
    const prospect =
      prospects.find((p) => normalizeEmail(p.email) === email) ??
      (await findProspectByEmail(email));
    if (!prospect) continue;
    scannedIds.add(prospect.id);
    const hasList = (prospect.lists ?? []).some(
      (l) => l.trim().toLowerCase() === listKey,
    );
    if (hasList) continue;
    const nextLists = uniqStrings([...(prospect.lists ?? []), listName]);
    const patched = await updateProspect(prospect.id, { lists: nextLists });
    if (patched) added += 1;
  }

  for (const p of scanned) {
    const email = normalizeEmail(p.email);
    if (pendingEmails.has(email)) continue;
    const nextLists = (p.lists ?? []).filter(
      (l) => l.trim().toLowerCase() !== listKey,
    );
    if (nextLists.length === (p.lists ?? []).length) continue;
    const patched = await updateProspect(p.id, { lists: nextLists });
    if (patched) removed += 1;
  }

  return {
    added,
    removed,
    total: pendingEmails.size,
    listName,
  };
}

/** Resolve event id from slug, then sync the SANS RÉPONSE playlist. */
export async function syncStdSansReponseListBySlug(
  eventSlug: string,
): Promise<{ added: number; removed: number; total: number; listName: string }> {
  const slug = eventSlug.trim();
  const listName = interestSansReponseListName(slug);
  if (!slug || !isFirebaseAdminConfigured()) {
    return { added: 0, removed: 0, total: 0, listName };
  }

  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.events)
    .where("slug", "==", slug)
    .limit(1)
    .get();
  const eventId = snap.docs[0]?.id;
  if (!eventId) {
    return { added: 0, removed: 0, total: 0, listName };
  }

  return syncStdSansReponseList({ eventSlug: slug, eventId });
}
