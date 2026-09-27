import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { persistDatabasePersoSyncStatus } from "@/lib/member/persist-signup-delivery";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { syncWaitlistMemberBidirectional } from "@/lib/member/sync-database-perso";
import type { WaitlistRegistration } from "@/lib/types/events";

type Params = { params: Promise<{ id: string }> };

/** Bidirectional resync: Perso → LA MESA enrich, then LA MESA → Perso push. */
export async function POST(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const ref = db.collection(COLLECTIONS.waitlist).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const member = { id: snap.id, ...(snap.data() as Omit<WaitlistRegistration, "id">) };
    if (isSoftDeleted(member)) {
      return NextResponse.json({ ok: false, error: "deleted" }, { status: 409 });
    }

    const { enrich, push, merged } = await syncWaitlistMemberBidirectional(
      member,
      "[admin/waitlist/sync-perso]",
    );

    const now = new Date().toISOString();
    const enrichPatch = { ...enrich.patch };
    if (Object.keys(enrichPatch).length > 0) {
      await ref.set(
        {
          ...enrichPatch,
          updatedAt: now,
          databasePersoPulledAt: now,
        },
        { merge: true },
      );
    }

    await persistDatabasePersoSyncStatus(member.id, push);

    if (push.skipped) {
      return NextResponse.json({
        ok: true,
        status: "skipped",
        error: push.error ?? "skipped",
        enrichedFields: Object.keys(enrich.patch),
      });
    }

    if (!push.ok || !push.id) {
      return NextResponse.json(
        {
          ok: false,
          status: "failed",
          error: push.error ?? "sync_failed",
          enrichedFields: Object.keys(enrich.patch),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: "synced",
      databasePersoContactId: push.id,
      databasePersoSyncedAt: now,
      enrichedFields: Object.keys(enrich.patch),
      pulled: enrich.ok && !enrich.skipped,
      fullName: merged.fullName,
      company: merged.company,
      linkedinUrl: merged.linkedinUrl,
    });
  } catch (error) {
    console.error("[admin/waitlist sync-perso]", error);
    return NextResponse.json({ ok: false, error: "sync_failed" }, { status: 502 });
  }
}
