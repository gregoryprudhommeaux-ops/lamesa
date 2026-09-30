import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { requireVerifiedUser } from "@/lib/auth/member.server";
import { isOrganizerParticipation } from "@/lib/events/capacity";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEventParticipation } from "@/lib/types/events";

function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

type Params = { params: Promise<{ id: string }> };

/**
 * Member declares they sent the ACCESS SPEI transfer.
 * Does NOT mark Payé — admin confirms on bank receipt.
 */
export async function POST(request: Request, { params }: Params) {
  const user = await requireVerifiedUser(request);
  if (isNextResponse(user)) return user;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;
  const email = normalizeEmail(user.email!);
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.participations).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const part = {
    id: snap.id,
    ...(snap.data() as Omit<AdminEventParticipation, "id">),
  };

  if (normalizeEmail(part.email) !== email) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (isOrganizerParticipation(part)) {
    return NextResponse.json({ ok: false, error: "organizer" }, { status: 400 });
  }

  const status = normalizeParticipationStatus(part.status);
  if (status === "confirmed" || status === "comped" || status === "not_attending") {
    return NextResponse.json({
      ok: true,
      alreadySettled: true,
      paymentDeclaredAt: part.paymentDeclaredAt ?? null,
    });
  }
  if (!part.calendarInviteSentAt) {
    return NextResponse.json({ ok: false, error: "not_invited" }, { status: 400 });
  }

  if (part.paymentDeclaredAt) {
    return NextResponse.json({
      ok: true,
      alreadyDeclared: true,
      paymentDeclaredAt: part.paymentDeclaredAt,
    });
  }

  const now = new Date().toISOString();
  await ref.set({ paymentDeclaredAt: now, updatedAt: now }, { merge: true });

  void import("@/lib/contacts/activities-store").then(({ recordContactActivity }) =>
    recordContactActivity({
      email: part.email,
      type: "payment_declared",
      source: "guest",
      summary: "Virement ACCESS déclaré (en attente confirmation)",
      refs: { eventId: part.eventId, participationId: id },
      meta: { epistemic: "declared" },
    }),
  ).catch(() => undefined);

  return NextResponse.json({ ok: true, paymentDeclaredAt: now });
}
