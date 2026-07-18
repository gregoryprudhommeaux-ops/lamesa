import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS, getAdminFirestore } from "@/lib/firebase/admin";

export type WelcomeEmailResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; error: string };

export type DatabasePersoSyncResult = {
  ok: boolean;
  id?: string;
  skipped?: boolean;
};

/** Persist Database Perso upsert outcome on the waitlist doc. */
export async function persistDatabasePersoSyncStatus(
  waitlistId: string,
  sync: DatabasePersoSyncResult,
): Promise<void> {
  const status = sync.skipped ? "skipped" : sync.ok && sync.id ? "synced" : "failed";
  const now = new Date().toISOString();
  await getAdminFirestore()
    .collection(COLLECTIONS.waitlist)
    .doc(waitlistId)
    .set(
      {
        databasePersoSyncStatus: status,
        ...(sync.id
          ? {
              databasePersoContactId: sync.id,
              databasePersoSyncedAt: now,
            }
          : {}),
      },
      { merge: true },
    );
}

/** Persist welcome / express confirmation email outcome on the waitlist doc. */
export async function persistWelcomeEmailStatus(
  waitlistId: string,
  mail: WelcomeEmailResult,
): Promise<"sent" | "failed" | "skipped"> {
  const status =
    !mail.ok ? "failed" : "skipped" in mail && mail.skipped ? "skipped" : "sent";
  const now = new Date().toISOString();
  await getAdminFirestore()
    .collection(COLLECTIONS.waitlist)
    .doc(waitlistId)
    .set(
      {
        welcomeEmailStatus: status,
        welcomeEmailSentAt: now,
        ...(status === "failed" && !mail.ok
          ? { welcomeEmailError: mail.error }
          : { welcomeEmailError: FieldValue.delete() }),
      },
      { merge: true },
    );
  return status;
}
