import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { persistDatabasePersoSyncStatus } from "@/lib/member/persist-signup-delivery";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import { syncWaitlistMemberBidirectional } from "@/lib/member/sync-database-perso";
import type { WaitlistRegistration } from "@/lib/types/events";

const bodySchema = z
  .object({
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

/**
 * Bulk bidirectional resync for waitlist rows stuck on databasePersoSyncStatus=failed.
 */
export async function POST(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let limit = 25;
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }
    if (parsed.data.limit) limit = parsed.data.limit;
  } catch {
    // empty body is fine
  }

  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection(COLLECTIONS.waitlist)
      .where("databasePersoSyncStatus", "==", "failed")
      .limit(limit)
      .get();

    const results: Array<{
      id: string;
      email?: string;
      status: "synced" | "failed" | "skipped" | "deleted";
      error?: string;
      enrichedFields?: string[];
    }> = [];

    let synced = 0;
    let failed = 0;
    let skipped = 0;

    for (const doc of snap.docs) {
      const member = { id: doc.id, ...(doc.data() as Omit<WaitlistRegistration, "id">) };
      if (isSoftDeleted(member)) {
        skipped += 1;
        results.push({ id: member.id, email: member.email, status: "deleted" });
        continue;
      }

      const { enrich, push } = await syncWaitlistMemberBidirectional(
        member,
        "[admin/waitlist/resync-perso-failed]",
      );

      const now = new Date().toISOString();
      if (Object.keys(enrich.patch).length > 0) {
        await doc.ref.set(
          {
            ...enrich.patch,
            updatedAt: now,
            databasePersoPulledAt: now,
          },
          { merge: true },
        );
      }
      await persistDatabasePersoSyncStatus(member.id, push);

      if (push.skipped) {
        skipped += 1;
        results.push({
          id: member.id,
          email: member.email,
          status: "skipped",
          error: push.error,
          enrichedFields: Object.keys(enrich.patch),
        });
        continue;
      }

      if (!push.ok || !push.id) {
        failed += 1;
        results.push({
          id: member.id,
          email: member.email,
          status: "failed",
          error: push.error,
          enrichedFields: Object.keys(enrich.patch),
        });
        continue;
      }

      synced += 1;
      results.push({
        id: member.id,
        email: member.email,
        status: "synced",
        enrichedFields: Object.keys(enrich.patch),
      });
    }

    return NextResponse.json({
      ok: true,
      scanned: snap.size,
      synced,
      failed,
      skipped,
      results,
    });
  } catch (error) {
    console.error("[admin/waitlist resync-perso-failed]", error);
    return NextResponse.json({ ok: false, error: "sync_failed" }, { status: 502 });
  }
}
