import { FieldValue } from "firebase-admin/firestore";
import {
  findWaitlistByEmail,
  findWaitlistByEmailIncludingDeleted,
  linkWaitlistUid,
} from "@/lib/auth/member.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { syncWaitlistMemberToProspects } from "@/lib/member/sync-waitlist-to-prospects";
import type { WaitlistRegistration } from "@/lib/types/events";

export type EnsuredWaitlistProfile = WaitlistRegistration & {
  id: string;
  uid?: string;
  linkedAt?: string;
  /** True when a new waitlist doc was created. */
  provisioned?: boolean;
  /** True when a soft-deleted waitlist doc was revived. */
  revived?: boolean;
};

export type EnsureWaitlistSource = "la-mesa-interest" | "la-mesa-std-invite";

function stubFullName(email: string, displayName?: string | null): string {
  const fromAuth = displayName?.trim();
  if (fromAuth) return fromAuth.slice(0, 120);
  const local = email.split("@")[0]?.trim() || "Membre";
  return local.slice(0, 120);
}

/** @internal exported for unit tests */
export function waitlistStubFullNameForAuth(
  email: string,
  displayName?: string | null,
): string {
  return stubFullName(email, displayName);
}

/**
 * Ensure an active waitlist row exists for this email (revive or create stub).
 * Used by STD send ops and by Auth interest heal.
 */
export async function ensureWaitlistProfileByEmail(input: {
  email: string;
  fullName?: string | null;
  company?: string | null;
  phone?: string | null;
  locale?: string;
  source: EnsureWaitlistSource;
  /** When linking a signed-in Auth user. */
  uid?: string | null;
}): Promise<EnsuredWaitlistProfile | null> {
  if (!isFirebaseAdminConfigured()) return null;

  const email = normalizeEmail(input.email);
  if (!email.includes("@")) return null;

  const now = new Date().toISOString();
  const db = getAdminFirestore();
  const uid = input.uid?.trim() || undefined;

  let waitlist = await findWaitlistByEmail(email);
  if (waitlist) {
    if (uid && !waitlist.uid) {
      await linkWaitlistUid(waitlist.id, uid);
      waitlist = { ...waitlist, uid, linkedAt: now };
    }
    return waitlist;
  }

  const includingDeleted = await findWaitlistByEmailIncludingDeleted(email);
  if (includingDeleted && isSoftDeleted(includingDeleted)) {
    const nextName =
      includingDeleted.fullName?.trim() ||
      input.fullName?.trim() ||
      stubFullName(email, input.fullName);
    await db.collection(COLLECTIONS.waitlist).doc(includingDeleted.id).set(
      {
        deletedAt: FieldValue.delete(),
        updatedAt: now,
        fullName: nextName,
        ...(input.company?.trim() && !includingDeleted.company?.trim()
          ? { company: input.company.trim() }
          : {}),
        ...(input.phone?.trim() && !includingDeleted.phone?.trim()
          ? { phone: input.phone.trim() }
          : {}),
        ...(uid ? { uid, linkedAt: now } : {}),
      },
      { merge: true },
    );
    const revived: EnsuredWaitlistProfile = {
      ...includingDeleted,
      deletedAt: undefined,
      fullName: nextName,
      updatedAt: now,
      revived: true,
      ...(uid ? { uid, linkedAt: now } : {}),
    };
    void syncWaitlistMemberToProspects(revived, "[ensure-waitlist]").catch((err) => {
      console.warn("[ensure-waitlist] prospect sync failed (revive)", err);
    });
    return revived;
  }

  const fullName =
    input.fullName?.trim() || stubFullName(email, input.fullName);
  const tags =
    input.source === "la-mesa-std-invite"
      ? ["la-mesa", "waitlist", "std-invite"]
      : ["la-mesa", "waitlist", "interest-auto"];

  const record: Omit<WaitlistRegistration, "id"> = {
    fullName,
    linkedinUrl: "",
    email,
    company: input.company?.trim() || "",
    sector: "",
    position: "",
    extraActivities: [],
    city: "",
    phone: input.phone?.trim() || "",
    invitationMotivation: "",
    locale: input.locale?.trim() || "fr",
    source: input.source,
    tags,
    profileComplete: false,
    createdAt: now,
    updatedAt: now,
    ...(uid ? { uid, linkedAt: now } : {}),
  };

  const ref = await db.collection(COLLECTIONS.waitlist).add(record);
  const created: EnsuredWaitlistProfile = {
    id: ref.id,
    ...record,
    provisioned: true,
  };

  void syncWaitlistMemberToProspects(created, "[ensure-waitlist]").catch((err) => {
    console.warn("[ensure-waitlist] prospect sync failed (create)", err);
  });

  return created;
}

/**
 * Auth session is enough to answer interest / STD forms.
 * If no active waitlist row exists for the email, revive soft-deleted or create a light stub.
 */
export async function ensureWaitlistProfileForAuth(input: {
  uid: string;
  email: string;
  displayName?: string | null;
  locale?: string;
}): Promise<EnsuredWaitlistProfile | null> {
  return ensureWaitlistProfileByEmail({
    email: input.email,
    fullName: input.displayName,
    locale: input.locale,
    source: "la-mesa-interest",
    uid: input.uid,
  });
}
