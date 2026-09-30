/**
 * Apply OUI → Audience participation upserts (Firestore).
 */
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { findWaitlistByEmail } from "@/lib/auth/member.server";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import {
  planOuiParticipationUpserts,
  summarizeOuiUpsertPlans,
  type OuiParticipationInput,
} from "@/lib/events/sync-interest-oui-to-participations";
import { COLLECTIONS } from "@/lib/firebase/admin";
import type { Firestore } from "firebase-admin/firestore";

export async function applyOuiEmailsToParticipations(input: {
  db: Firestore;
  eventId: string;
  ouiEmails: string[];
  now?: string;
}): Promise<{ create: number; promote: number; noop: number }> {
  const now = input.now ?? new Date().toISOString();
  const snap = await input.db
    .collection(COLLECTIONS.participations)
    .where("eventId", "==", input.eventId)
    .limit(500)
    .get();

  const participations: OuiParticipationInput[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      email: String(data.email ?? ""),
      status: String(data.status ?? ""),
      calendarInviteSentAt: data.calendarInviteSentAt
        ? String(data.calendarInviteSentAt)
        : null,
      isOrganizer: Boolean(data.isOrganizer) || isOrganizerParticipation({
        email: String(data.email ?? ""),
        isOrganizer: data.isOrganizer,
        fullName: data.fullName != null ? String(data.fullName) : undefined,
      }),
    };
  });

  const plans = planOuiParticipationUpserts({
    ouiEmails: input.ouiEmails,
    participations,
  });

  for (const plan of plans) {
    if (plan.action === "create") {
      const waitlist = await findWaitlistByEmail(plan.email);
      await input.db.collection(COLLECTIONS.participations).add({
        eventId: input.eventId,
        email: plan.email,
        fullName: waitlist?.fullName ?? null,
        companyName: waitlist?.company ?? null,
        contactId: waitlist?.id ?? null,
        status: "attending",
        statusSource: "guest",
        interestResponse: "yes",
        createdAt: now,
        updatedAt: now,
      });
      void import("@/lib/contacts/activities-store").then(({ recordContactActivity }) =>
        recordContactActivity({
          email: plan.email,
          type: "interest_yes",
          source: "guest",
          summary: "OUI intérêt → Audience (attending)",
          refs: { eventId: input.eventId },
        }),
      );
    } else if (plan.action === "promote") {
      await input.db.collection(COLLECTIONS.participations).doc(plan.participationId).set(
        {
          status: "attending",
          statusSource: "guest",
          interestResponse: "yes",
          updatedAt: now,
        },
        { merge: true },
      );
    }
  }

  return summarizeOuiUpsertPlans(plans);
}

/** Single-email helper for interest form submit. */
export async function ensureOuiParticipationForEmail(input: {
  db: Firestore;
  eventId: string;
  email: string;
  fullName?: string | null;
  companyName?: string | null;
  now?: string;
}): Promise<"created" | "promoted" | "noop"> {
  const email = normalizeEmail(input.email);
  const result = await applyOuiEmailsToParticipations({
    db: input.db,
    eventId: input.eventId,
    ouiEmails: [email],
    now: input.now,
  });
  if (result.create > 0) return "created";
  if (result.promote > 0) return "promoted";
  return "noop";
}
