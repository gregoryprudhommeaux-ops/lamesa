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
  /** True when a new waitlist doc was created for this Auth user. */
  provisioned?: boolean;
  /** True when a soft-deleted waitlist doc was revived. */
  revived?: boolean;
};

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
 * Auth session is enough to answer interest / STD forms.
 * If no active waitlist row exists for the email, revive soft-deleted or create a light stub.
 */
export async function ensureWaitlistProfileForAuth(input: {
  uid: string;
  email: string;
  displayName?: string | null;
  locale?: string;
}): Promise<EnsuredWaitlistProfile | null> {
  if (!isFirebaseAdminConfigured()) return null;

  const email = normalizeEmail(input.email);
  if (!email.includes("@")) return null;

  const now = new Date().toISOString();
  const db = getAdminFirestore();

  let waitlist = await findWaitlistByEmail(email);
  if (waitlist) {
    if (!waitlist.uid) {
      await linkWaitlistUid(waitlist.id, input.uid);
      waitlist = { ...waitlist, uid: input.uid, linkedAt: now };
    }
    return waitlist;
  }

  const includingDeleted = await findWaitlistByEmailIncludingDeleted(email);
  if (includingDeleted && isSoftDeleted(includingDeleted)) {
    await db.collection(COLLECTIONS.waitlist).doc(includingDeleted.id).set(
      {
        deletedAt: FieldValue.delete(),
        uid: input.uid,
        linkedAt: now,
        updatedAt: now,
        ...(includingDeleted.fullName?.trim()
          ? {}
          : { fullName: stubFullName(email, input.displayName) }),
      },
      { merge: true },
    );
    const revived: EnsuredWaitlistProfile = {
      ...includingDeleted,
      deletedAt: undefined,
      uid: input.uid,
      linkedAt: now,
      updatedAt: now,
      fullName: includingDeleted.fullName?.trim() || stubFullName(email, input.displayName),
      revived: true,
    };
    void syncWaitlistMemberToProspects(revived, "[ensure-waitlist-auth]").catch((err) => {
      console.warn("[ensure-waitlist-auth] prospect sync failed (revive)", err);
    });
    return revived;
  }

  const fullName = stubFullName(email, input.displayName);
  const record: Omit<WaitlistRegistration, "id"> = {
    fullName,
    linkedinUrl: "",
    email,
    company: "",
    sector: "",
    position: "",
    extraActivities: [],
    city: "",
    phone: "",
    invitationMotivation: "",
    locale: input.locale?.trim() || "fr",
    source: "la-mesa-interest",
    tags: ["la-mesa", "waitlist", "interest-auto"],
    profileComplete: false,
    createdAt: now,
    uid: input.uid,
    linkedAt: now,
    updatedAt: now,
  };

  const ref = await db.collection(COLLECTIONS.waitlist).add(record);
  const created: EnsuredWaitlistProfile = {
    id: ref.id,
    ...record,
    provisioned: true,
  };

  void syncWaitlistMemberToProspects(created, "[ensure-waitlist-auth]").catch((err) => {
    console.warn("[ensure-waitlist-auth] prospect sync failed (create)", err);
  });

  return created;
}
