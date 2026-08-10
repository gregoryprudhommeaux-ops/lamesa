import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  createProspectList,
  deleteProspectList,
  listProspectLists,
  renameProspectList,
} from "@/lib/prospects/lists-store";

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }
  try {
    const lists = await listProspectLists();
    return NextResponse.json({ ok: true, lists });
  } catch (error) {
    console.error("[admin/prospects/lists GET]", error);
    return NextResponse.json({ ok: false, error: "list_failed" }, { status: 502 });
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  try {
    const result = await createProspectList(parsed.data.name);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, list: result.list });
  } catch (error) {
    console.error("[admin/prospects/lists POST]", error);
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 502 });
  }
}

const patchSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(80),
});

export async function PATCH(request: Request) {
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  try {
    const result = await renameProspectList(parsed.data.id, parsed.data.name);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.error === "not_found" ? 404 : 400 },
      );
    }
    return NextResponse.json({ ok: true, list: result.list });
  } catch (error) {
    console.error("[admin/prospects/lists PATCH]", error);
    return NextResponse.json({ ok: false, error: "rename_failed" }, { status: 502 });
  }
}

const deleteSchema = z.object({
  id: z.string().trim().min(1),
  removeFromContacts: z.boolean().optional(),
});

export async function DELETE(request: Request) {
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
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  try {
    const result = await deleteProspectList(parsed.data.id, {
      removeFromContacts: parsed.data.removeFromContacts,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/prospects/lists DELETE]", error);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 502 });
  }
}
