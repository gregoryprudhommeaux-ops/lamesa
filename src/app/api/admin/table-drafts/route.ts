import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import {
  listNormalizedTableDrafts,
  tableDraftCreateSchema,
} from "@/lib/admin/table-drafts";
import {
  COLLECTIONS,
  getAdminFirestore,
  isFirebaseAdminConfigured,
} from "@/lib/firebase/admin";
import type { TableDraftStatus } from "@/lib/types/events";

const statuses = new Set<TableDraftStatus>(["draft", "used", "archived"]);

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const requestedStatus = new URL(request.url).searchParams.get("status");
  if (requestedStatus !== null && !statuses.has(requestedStatus as TableDraftStatus)) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  try {
    const snapshot = await getAdminFirestore().collection(COLLECTIONS.tableDrafts).get();
    const drafts = listNormalizedTableDrafts(
      snapshot.docs,
      requestedStatus as TableDraftStatus | null,
    );
    return NextResponse.json({ ok: true, drafts });
  } catch (error) {
    console.error("[admin/table-drafts GET]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = tableDraftCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const now = new Date().toISOString();
  try {
    const reference = await getAdminFirestore().collection(COLLECTIONS.tableDrafts).add({
      ...parsed.data,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      createdByUid: admin.uid,
      createdByEmail: admin.email,
    });
    return NextResponse.json({ ok: true, id: reference.id });
  } catch (error) {
    console.error("[admin/table-drafts POST]", error);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }
}
