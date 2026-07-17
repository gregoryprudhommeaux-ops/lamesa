import { NextResponse } from "next/server";
import { composeTableIdeas, TableIdeasError } from "@/lib/admin/table-matching";
import { tableIdeasRequestSchema } from "@/lib/admin/table-matching/schemas";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type {
  AdminEvent,
  AdminEventParticipation,
  WaitlistRegistration,
} from "@/lib/types/events";

const TABLE_IDEAS_ERROR_STATUS: Record<TableIdeasError["code"], number> = {
  validation: 400,
  pool_too_small: 422,
  ai_not_configured: 503,
  ai_invalid: 502,
  fetch_failed: 502,
};

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

  const parsed = tableIdeasRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const { city, mode, excludeMemberIds } = parsed.data;
  const theme = parsed.data.mode === "admin_theme" ? parsed.data.theme : undefined;

  try {
    const db = getAdminFirestore();
    const [waitlistSnap, eventsSnap, partsSnap] = await Promise.all([
      db.collection(COLLECTIONS.waitlist).limit(3000).get(),
      db.collection(COLLECTIONS.events).limit(300).get(),
      db.collection(COLLECTIONS.participations).limit(5000).get(),
    ]);

    const members = waitlistSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<WaitlistRegistration, "id">),
    }));
    const events = eventsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdminEvent, "id">),
    }));
    const participations = partsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdminEventParticipation, "id">),
    }));

    const { ideas, poolSize } = await composeTableIdeas({
      mode,
      theme,
      members,
      participations,
      events,
      city,
      excludeMemberIds,
    });

    return NextResponse.json({ ok: true, poolSize, ideas });
  } catch (error) {
    if (error instanceof TableIdeasError) {
      if (error.code === "fetch_failed" && error.message && error.message !== "fetch_failed") {
        console.error("[admin/table-ideas]", error.message);
      }
      return NextResponse.json(
        { ok: false, error: error.code },
        { status: TABLE_IDEAS_ERROR_STATUS[error.code] },
      );
    }
    console.error("[admin/table-ideas]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}
