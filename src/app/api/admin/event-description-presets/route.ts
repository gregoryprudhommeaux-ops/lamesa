import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import {
  createEventDescriptionPreset,
  deleteEventDescriptionPreset,
  listEventDescriptionPresets,
} from "@/lib/events/description-presets";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  introText: z.string().trim().max(2000).optional(),
  subtitle: z.string().trim().max(200).optional(),
  menuIncluded: z.string().trim().max(4000).optional(),
});

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: true, presets: [], dev: true });
  }

  try {
    const presets = await listEventDescriptionPresets();
    return NextResponse.json({ ok: true, presets });
  } catch (error) {
    console.error("[event-description-presets GET]", error);
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  try {
    const preset = await createEventDescriptionPreset(parsed.data);
    return NextResponse.json({ ok: true, preset });
  } catch (error) {
    console.error("[event-description-presets POST]", error);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  try {
    await deleteEventDescriptionPreset(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[event-description-presets DELETE]", error);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 502 });
  }
}
