import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { sendTemplatedEventEmail } from "@/lib/email/send-calendar-invite";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum([
    "invited",
    "attending",
    "confirmed",
    "not_attending",
    "waitlist",
    "present",
    "declined",
  ]),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const nextStatus = normalizeParticipationStatus(parsed.data.status);

  try {
    const db = getAdminFirestore();
    const ref = db.collection(COLLECTIONS.participations).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const prev = {
      id: snap.id,
      ...(snap.data() as Omit<AdminEventParticipation, "id">),
    };
    const prevStatus = normalizeParticipationStatus(prev.status);
    const now = new Date().toISOString();

    await ref.set(
      {
        status: nextStatus,
        statusSource: "admin",
        updatedAt: now,
      },
      { merge: true },
    );

    if (nextStatus === "confirmed" && prevStatus !== "confirmed") {
      void (async () => {
        try {
          const eventSnap = await db.collection(COLLECTIONS.events).doc(prev.eventId).get();
          if (!eventSnap.exists) return;
          const event = {
            id: eventSnap.id,
            ...(eventSnap.data() as Omit<AdminEvent, "id">),
          };
          const participation: AdminEventParticipation = {
            ...prev,
            status: "confirmed",
            updatedAt: now,
          };
          const result = await sendTemplatedEventEmail({
            key: "participation_confirmed",
            event,
            participation,
          });
          if (result.ok) {
            await ref.set(
              { confirmationEmailSentAt: new Date().toISOString() },
              { merge: true },
            );
          } else {
            console.error("[participation confirmed email]", result.error);
          }
        } catch (e) {
          console.error("[participation confirmed email]", e);
        }
      })();
    }

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error) {
    console.error("[participation PATCH]", error);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }
}
