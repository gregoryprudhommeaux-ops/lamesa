import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { slugify } from "@/lib/events/utils";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  organizerName: z.string().trim().max(120).optional(),
  introText: z.string().trim().max(2000).optional(),
  venueName: z.string().trim().max(200).optional(),
  address: z.string().trim().max(300).optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  capacity: z.number().int().min(1).max(100).optional(),
  priceMxn: z.number().min(0).max(1_000_000).optional().nullable(),
  accessIncludesWelcomeDrink: z.boolean().optional(),
  accessIncludesAmuseBouche: z.boolean().optional(),
  menuIncluded: z.string().trim().max(4000).optional().nullable(),
  menuPriceMinMxn: z.number().min(0).max(1_000_000).optional().nullable(),
  menuPriceMaxMxn: z.number().min(0).max(1_000_000).optional().nullable(),
  menuIncludesDrinks: z.boolean().optional().nullable(),
  pricingMode: z.enum(["ticket_onsite", "all_inclusive"]).optional().nullable(),
  format: z.enum(["breakfast", "coffee", "aperitif", "dinner"]).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  status: z.enum(["draft", "published", "closed"]).optional(),
  eventLanguage: z.enum(["fr", "es", "en"]).optional(),
  mapsUrl: z.string().url().optional().or(z.literal("")).nullable(),
  registrationFormUrl: z.string().url().optional().or(z.literal("")).nullable(),
  flyerUrl: z.string().url().optional().or(z.literal("")).nullable(),
  dressCode: z
    .enum(["casual", "smart_casual", "business", "formal", "traditional", "none_specified"])
    .optional()
    .nullable(),
  parking: z.enum(["secure_nearby", "valet", "on_site", "unknown"]).optional().nullable(),
  shareEnabled: z.boolean().optional(),
  responseMode: z.enum(["rsvp", "interest"]).optional(),
  subtitle: z.string().trim().max(200).optional().nullable(),
  interestDeadlineAt: z.string().optional().nullable(),
  allInPriceMinMxn: z.number().min(0).max(1_000_000).optional().nullable(),
  allInPriceMaxMxn: z.number().min(0).max(1_000_000).optional().nullable(),
  mesaNumber: z.number().int().min(1).max(9999).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const data = parsed.data;
  const db = getAdminFirestore();

  try {
    await db.collection(COLLECTIONS.events).doc(id).set(
      {
        ...data,
        slug: slugify(data.title),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("[admin/events PATCH]", error);
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
  const db = getAdminFirestore();

  try {
    const parts = await db
      .collection(COLLECTIONS.participations)
      .where("eventId", "==", id)
      .get();
    await Promise.all(parts.docs.map((d) => d.ref.delete()));
    await db.collection(COLLECTIONS.events).doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/events DELETE]", error);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 502 });
  }
}
