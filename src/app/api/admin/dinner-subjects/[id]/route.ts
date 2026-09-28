import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { CITY_HUBS } from "@/lib/constants/city-hubs";
import { isValidPeriodMonth } from "@/lib/dinner-subjects/period";
import { deleteDinnerSubject, updateDinnerSubject } from "@/lib/dinner-subjects/store";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    summary: z.string().trim().max(400).optional(),
    periodMonth: z
      .string()
      .trim()
      .refine((v) => isValidPeriodMonth(v), { message: "invalid_period" })
      .optional(),
    city: z.enum(CITY_HUBS).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    keywords: z.array(z.string().trim().min(1).max(80)).max(24).optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();

export async function PATCH(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ ok: false, error: "empty_patch" }, { status: 400 });
  }

  try {
    const subject = await updateDinnerSubject(id, parsed.data);
    if (!subject) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, subject });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "invalid_subject" || message === "invalid_period") {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }
    console.error("[admin/dinner-subjects PATCH]", error);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
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
    const deleted = await deleteDinnerSubject(id);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/dinner-subjects DELETE]", error);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 502 });
  }
}
