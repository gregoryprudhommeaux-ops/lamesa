import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { nextInviteStatus } from "@/lib/events/capacity";
import { z } from "zod";

const inviteesSchema = z.object({
  inviteEmails: z
    .array(
      z.object({
        email: z.string().email(),
        fullName: z.string().optional(),
        companyName: z.string().optional(),
        contactId: z.string().optional(),
      }),
    )
    .min(1)
    .max(200),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id: eventId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = inviteesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const eventRef = db.collection(COLLECTIONS.events).doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const capacity = Number(eventSnap.data()?.capacity ?? 15);
  const existing = await db
    .collection(COLLECTIONS.participations)
    .where("eventId", "==", eventId)
    .get();
  const existingEmails = new Set(
    existing.docs.map((d) => normalizeEmail(String(d.data().email ?? ""))),
  );
  let seated = existing.docs.filter((d) => {
    const s = String(d.data().status ?? "");
    return s === "invited" || s === "present";
  }).length;

  let added = 0;
  let skipped = 0;
  let waitlisted = 0;

  try {
    for (const inv of parsed.data.inviteEmails) {
      const email = normalizeEmail(inv.email);
      if (!email || existingEmails.has(email)) {
        skipped += 1;
        continue;
      }
      const status = nextInviteStatus(capacity, seated);
      if (status === "invited") seated += 1;
      else waitlisted += 1;
      await db.collection(COLLECTIONS.participations).add({
        eventId,
        email,
        fullName: inv.fullName ?? null,
        companyName: inv.companyName ?? null,
        contactId: inv.contactId ?? null,
        status,
        statusSource: "admin",
        createdAt: now,
        updatedAt: now,
      });
      existingEmails.add(email);
      added += 1;
    }

    await eventRef.set({ updatedAt: now }, { merge: true });
    return NextResponse.json({ ok: true, added, skipped, waitlisted });
  } catch (error) {
    console.error("[admin/events invitees POST]", error);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }
}