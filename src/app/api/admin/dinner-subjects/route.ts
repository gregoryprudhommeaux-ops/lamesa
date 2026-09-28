import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { CITY_HUBS } from "@/lib/constants/city-hubs";
import { isValidPeriodMonth } from "@/lib/dinner-subjects/period";
import {
  createDinnerSubject,
  ensureDefaultDinnerSubjects,
  listDinnerSubjects,
} from "@/lib/dinner-subjects/store";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().max(400).optional(),
  periodMonth: z
    .string()
    .trim()
    .refine((v) => isValidPeriodMonth(v), { message: "invalid_period" }),
  city: z.enum(CITY_HUBS).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  keywords: z.array(z.string().trim().min(1).max(80)).max(24).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: true, subjects: [], dev: true });
  }

  try {
    await ensureDefaultDinnerSubjects();
    const subjects = await listDinnerSubjects({
      includeDrafts: true,
      includeArchived: true,
    });
    return NextResponse.json({ ok: true, subjects });
  } catch (error) {
    console.error("[admin/dinner-subjects GET]", error);
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
    const subject = await createDinnerSubject(parsed.data);
    return NextResponse.json({ ok: true, subject });
  } catch (error) {
    console.error("[admin/dinner-subjects POST]", error);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }
}
