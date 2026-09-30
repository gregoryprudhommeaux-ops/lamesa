import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  PLACES_AVAILABLE_AUTO_INSCRIT_KEEP_NAMES,
  softDeleteAdminProvisionedWaitlistStubs,
} from "@/lib/member/revoke-admin-waitlist-stubs";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type { WaitlistRegistration } from "@/lib/types/events";

/**
 * Soft-delete waitlist stubs auto-created by places_available email blasts.
 * Keeps Julian TORRES + Alice MUZELLEC (NON respondents).
 *
 * GET  → dry preview (who would be revoked / kept)
 * POST → apply soft-delete
 */
export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const rows = await loadPlacesAvailableStubs();
  const preview = classify(rows);

  return NextResponse.json({
    ok: true,
    dryRun: true,
    source: "la-mesa-places-available",
    total: rows.length,
    wouldRevoke: preview.revoke.map(summarize),
    wouldKeep: preview.keep.map(summarize),
    keepNames: PLACES_AVAILABLE_AUTO_INSCRIT_KEEP_NAMES,
  });
}

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const rows = await loadPlacesAvailableStubs();
  const preview = classify(rows);
  const result = await softDeleteAdminProvisionedWaitlistStubs(rows, {
    sources: ["la-mesa-places-available"],
    keepNameTokenGroups: PLACES_AVAILABLE_AUTO_INSCRIT_KEEP_NAMES,
    deletedReason: "places-available-auto-inscrit-revoked",
  });

  return NextResponse.json({
    ok: true,
    source: "la-mesa-places-available",
    revoked: result.revoked,
    kept: result.kept,
    revokedEmails: preview.revoke.map((r) => r.email),
    keptPeople: preview.keep.map(summarize),
  });
}

async function loadPlacesAvailableStubs(): Promise<
  Array<WaitlistRegistration & { id: string }>
> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.waitlist)
    .where("source", "==", "la-mesa-places-available")
    .limit(200)
    .get();

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<WaitlistRegistration, "id">),
  }));
}

function classify(rows: Array<WaitlistRegistration & { id: string }>) {
  const keep: Array<WaitlistRegistration & { id: string }> = [];
  const revoke: Array<WaitlistRegistration & { id: string }> = [];

  for (const row of rows) {
    if (isSoftDeleted(row)) continue;
    if (row.profileComplete === true) {
      keep.push(row);
      continue;
    }
    const name = String(row.fullName ?? "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
    const isKeep = PLACES_AVAILABLE_AUTO_INSCRIT_KEEP_NAMES.some((tokens) =>
      tokens.every((t) => name.includes(t)),
    );
    if (isKeep) keep.push(row);
    else revoke.push(row);
  }

  return { keep, revoke };
}

function summarize(row: WaitlistRegistration & { id: string }) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    createdAt: row.createdAt ?? null,
    profileComplete: row.profileComplete ?? null,
  };
}
