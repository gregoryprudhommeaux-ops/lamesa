import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  getProspectById,
  softDeleteProspect,
  updateProspect,
} from "@/lib/prospects/store";
import { PROSPECT_STATUSES } from "@/lib/types/prospects";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
  position: z.string().trim().max(200).optional(),
  sector: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  linkedin: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(4000).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  lists: z.array(z.string().trim().max(60)).max(30).optional(),
  status: z.enum(PROSPECT_STATUSES).optional(),
  seen: z.boolean().optional(),
});

export async function GET(request: Request, ctx: Ctx) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }
  const { id } = await ctx.params;
  const prospect = await getProspectById(id);
  if (!prospect) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, prospect });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }
  const { id } = await ctx.params;
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
  const prospect = await updateProspect(id, parsed.data);
  if (!prospect) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, prospect });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }
  const { id } = await ctx.params;
  const ok = await softDeleteProspect(id);
  if (!ok) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, id });
}
