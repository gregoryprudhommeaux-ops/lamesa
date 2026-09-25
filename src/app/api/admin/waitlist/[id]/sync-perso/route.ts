import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { persistDatabasePersoSyncStatus } from "@/lib/member/persist-signup-delivery";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { syncWaitlistMemberToDatabasePerso } from "@/lib/member/sync-database-perso";
import type { WaitlistRegistration } from "@/lib/types/events";

type Params = { params: Promise<{ id: string }> };

/** Force-resync one waitlist member to Database Perso. */
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
    const snap = await db.collection(COLLECTIONS.waitlist).doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const member = { id: snap.id, ...(snap.data() as Omit<WaitlistRegistration, "id">) };
    if (isSoftDeleted(member)) {
      return NextResponse.json({ ok: false, error: "deleted" }, { status: 409 });
    }

    const sync = await syncWaitlistMemberToDatabasePerso(member, "[admin/waitlist/sync-perso]");
    await persistDatabasePersoSyncStatus(member.id, sync);

    if (sync.skipped) {
      return NextResponse.json({
        ok: true,
        status: "skipped",
        error: sync.error ?? "skipped",
      });
    }

    if (!sync.ok || !sync.id) {
      return NextResponse.json(
        {
          ok: false,
          status: "failed",
          error: sync.error ?? "sync_failed",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: "synced",
      databasePersoContactId: sync.id,
      databasePersoSyncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[admin/waitlist sync-perso]", error);
    return NextResponse.json({ ok: false, error: "sync_failed" }, { status: 502 });
  }
}
