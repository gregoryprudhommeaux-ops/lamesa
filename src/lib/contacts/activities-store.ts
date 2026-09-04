import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { normalizeProspectEmail } from "@/lib/prospects/normalize";
import type {
  ContactActivity,
  ContactActivityInput,
  ContactActivityType,
} from "@/lib/types/contact-activities";
import { CONTACT_ACTIVITY_TYPES } from "@/lib/types/contact-activities";

function isActivityType(raw: unknown): raw is ContactActivityType {
  return (CONTACT_ACTIVITY_TYPES as readonly string[]).includes(String(raw ?? ""));
}

function docToActivity(id: string, data: Record<string, unknown>): ContactActivity | null {
  const email = normalizeProspectEmail(String(data.email ?? ""));
  if (!email.includes("@") || !isActivityType(data.type)) return null;
  return {
    id,
    email,
    type: data.type,
    at: String(data.at ?? data.createdAt ?? ""),
    source: (data.source as ContactActivity["source"]) || "system",
    summary: String(data.summary ?? ""),
    refs:
      data.refs && typeof data.refs === "object"
        ? (data.refs as ContactActivity["refs"])
        : undefined,
    meta:
      data.meta && typeof data.meta === "object"
        ? (data.meta as ContactActivity["meta"])
        : undefined,
    createdAt: String(data.createdAt ?? ""),
    derived: false,
  };
}

/** Soft-fail: never throws to caller. Returns id or null. */
export async function recordContactActivity(
  input: ContactActivityInput,
): Promise<string | null> {
  try {
    if (!isFirebaseAdminConfigured()) return null;
    const email = normalizeProspectEmail(input.email);
    if (!email.includes("@")) return null;
    const now = new Date().toISOString();
    const at = input.at?.trim() || now;
    const ref = getAdminFirestore().collection(COLLECTIONS.contactActivities).doc();
    const row: Omit<ContactActivity, "id" | "derived"> = {
      email,
      type: input.type,
      at,
      source: input.source ?? "system",
      summary: input.summary.trim() || input.type,
      refs: input.refs,
      meta: input.meta,
      createdAt: now,
    };
    await ref.set(row);
    return ref.id;
  } catch (error) {
    console.error("[contact-activities] record failed", error);
    return null;
  }
}

export async function listActivitiesByEmail(
  emailRaw: string,
  limit = 100,
): Promise<ContactActivity[]> {
  const email = normalizeProspectEmail(emailRaw);
  if (!email.includes("@")) return [];
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.contactActivities)
    .where("email", "==", email)
    .limit(Math.min(limit, 200))
    .get();
  const rows = snap.docs
    .map((d) => docToActivity(d.id, d.data() as Record<string, unknown>))
    .filter((a): a is ContactActivity => Boolean(a));
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return rows;
}
