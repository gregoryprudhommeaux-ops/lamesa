import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import {
  invalidateAdminCoreCollectionsCache,
  loadAdminCoreCollections,
} from "@/lib/admin/load-core-collections";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { eventSlugFromTitleAndDate, slugify } from "@/lib/events/utils";
import { nextInviteStatus, DEFAULT_GUEST_CAPACITY } from "@/lib/events/capacity";
import { ensureOrganizerParticipation } from "@/lib/events/ensure-organizer-participation";
import { eventSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: true, events: [], participations: [], dev: true });
  }

  try {
    const core = await loadAdminCoreCollections();
    const events = [...core.events].sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
    );

    const phoneByEmail = new Map<string, string>();
    for (const row of core.waitlist) {
      const email = normalizeEmail(String(row.email ?? ""));
      const phone = String(row.phone ?? "").trim();
      if (email && phone) phoneByEmail.set(email, phone);
    }

    const participations = core.participations.map((data) => {
      const email = normalizeEmail(String(data.email ?? ""));
      return {
        ...data,
        phone: phoneByEmail.get(email) ?? null,
      };
    });

    return NextResponse.json({ ok: true, events, participations });
  } catch (error) {
    console.error("[admin/events GET]", error);
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

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const data = parsed.data;
  const db = getAdminFirestore();
  const now = new Date().toISOString();
  const slug = eventSlugFromTitleAndDate(data.title, data.startsAt) || slugify(data.title);

  try {
    const capacity = data.capacity ?? DEFAULT_GUEST_CAPACITY;
    const ref = await db.collection(COLLECTIONS.events).add({
      slug,
      title: data.title,
      organizerName: data.organizerName ?? "LA MESA",
      introText: data.introText ?? "",
      venueName: data.venueName ?? "",
      address: data.address ?? "",
      startsAt: data.startsAt,
      endsAt: data.endsAt ?? null,
      capacity,
      priceMxn: data.priceMxn ?? null,
      accessIncludesWelcomeDrink: data.accessIncludesWelcomeDrink ?? false,
      accessIncludesAmuseBouche: data.accessIncludesAmuseBouche ?? false,
      menuIncluded: data.menuIncluded ?? "",
      menuPriceMinMxn: data.menuPriceMinMxn ?? null,
      menuPriceMaxMxn: data.menuPriceMaxMxn ?? null,
      menuIncludesDrinks: data.menuIncludesDrinks ?? null,
      pricingMode: data.pricingMode ?? "ticket_onsite",
      format: data.format ?? "dinner",
      status: data.status ?? "draft",
      eventLanguage: data.eventLanguage ?? "es",
      dressCode: data.dressCode ?? "none_specified",
      parking: data.parking ?? "unknown",
      mapsUrl: data.mapsUrl || null,
      registrationFormUrl: data.registrationFormUrl || null,
      flyerUrl: data.flyerUrl || null,
      shareEnabled: data.shareEnabled ?? false,
      responseMode: data.responseMode ?? "rsvp",
      subtitle: data.subtitle ?? "",
      interestDeadlineAt: data.interestDeadlineAt ?? null,
      allInPriceMinMxn: data.allInPriceMinMxn ?? null,
      allInPriceMaxMxn: data.allInPriceMaxMxn ?? null,
      mesaNumber: data.mesaNumber ?? null,
      city: data.city ?? null,
      createdAt: now,
      updatedAt: now,
      createdByUid: admin.uid,
    });

    const inviteEmails = data.inviteEmails ?? [];
    let seated = 0;
    for (const inv of inviteEmails) {
      const preferred = inv.status;
      const status =
        preferred === "waitlist"
          ? "waitlist"
          : nextInviteStatus(capacity, seated);
      if (status === "invited") seated += 1;
      await db.collection(COLLECTIONS.participations).add({
        eventId: ref.id,
        email: normalizeEmail(inv.email),
        fullName: inv.fullName ?? null,
        companyName: inv.companyName ?? null,
        contactId: inv.contactId ?? null,
        status,
        statusSource: "admin",
        createdAt: now,
        updatedAt: now,
      });
    }

    await ensureOrganizerParticipation(db, ref.id, now);

    invalidateAdminCoreCollectionsCache();
    return NextResponse.json({ ok: true, id: ref.id, slug });
  } catch (error) {
    console.error("[admin/events POST]", error);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }
}
