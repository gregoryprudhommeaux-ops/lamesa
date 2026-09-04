import { NextResponse } from "next/server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type { WaitlistRegistration } from "@/lib/types/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WAITLIST_SCAN_LIMIT = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

function authorize(request: Request): boolean {
  const secret =
    process.env.JEFFREY_STATS_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV === "development";
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const q = new URL(request.url).searchParams.get("secret") ?? "";
  return bearer === secret || q === secret;
}

/**
 * Machine stats for Jeffrey morning digest.
 * Auth: Bearer JEFFREY_STATS_SECRET or CRON_SECRET (same pattern as /api/cron/*).
 */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  try {
    const db = getAdminFirestore();
    const snap = await db.collection(COLLECTIONS.waitlist).limit(WAITLIST_SCAN_LIMIT).get();
    const all = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<WaitlistRegistration, "id">),
    }));
    const active = all.filter((r) => !isSoftDeleted(r));
    const cutoff = Date.now() - DAY_MS;

    const newLast24h = active.filter((r) => {
      const created = Date.parse(r.createdAt);
      return !Number.isNaN(created) && created >= cutoff;
    }).length;

    const inscrits = active.length;
    const previousApprox = Math.max(0, inscrits - newLast24h);

    return NextResponse.json({
      ok: true,
      asOf: new Date().toISOString(),
      inscrits,
      newLast24h,
      previousApprox,
      truncated: snap.size >= WAITLIST_SCAN_LIMIT,
    });
  } catch (error) {
    console.error("[internal/jeffrey-stats]", error);
    return NextResponse.json({ ok: false, error: "upstream" }, { status: 500 });
  }
}
