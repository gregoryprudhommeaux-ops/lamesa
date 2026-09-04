import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { findWaitlistByEmailIncludingDeleted } from "@/lib/auth/member.server";
import { listActivitiesByEmail } from "@/lib/contacts/activities-store";
import {
  buildContactTimeline,
  deriveContactActivities,
} from "@/lib/contacts/build-timeline";
import { buildContactStats } from "@/lib/contacts/contact-stats";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { findProspectByEmail } from "@/lib/prospects/store";
import { normalizeProspectEmail } from "@/lib/prospects/normalize";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const email = normalizeProspectEmail(url.searchParams.get("email") ?? "");
  if (!email.includes("@")) {
    return NextResponse.json({ ok: false, error: "email_required" }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const [prospect, waitlist, activities, partsSnap] = await Promise.all([
      findProspectByEmail(email),
      findWaitlistByEmailIncludingDeleted(email),
      listActivitiesByEmail(email, 100),
      db.collection(COLLECTIONS.participations).where("email", "==", email).limit(100).get(),
    ]);

    let participations: AdminEventParticipation[] = partsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdminEventParticipation, "id">),
    }));

    // Also match by waitlist contactId if email query missed mixed-case legacy rows
    if (waitlist?.id) {
      const byContact = await db
        .collection(COLLECTIONS.participations)
        .where("contactId", "==", waitlist.id)
        .limit(50)
        .get();
      const byId = new Map(participations.map((p) => [p.id, p]));
      for (const d of byContact.docs) {
        if (!byId.has(d.id)) {
          byId.set(d.id, {
            id: d.id,
            ...(d.data() as Omit<AdminEventParticipation, "id">),
          });
        }
      }
      participations = [...byId.values()];
    }

    const eventIds = [...new Set(participations.map((p) => p.eventId).filter(Boolean))];
    const events: AdminEvent[] = (
      await Promise.all(
        eventIds.map(async (id) => {
          const snap = await db.collection(COLLECTIONS.events).doc(id).get();
          if (!snap.exists) return null;
          return { id: snap.id, ...(snap.data() as Omit<AdminEvent, "id">) };
        }),
      )
    ).filter((e): e is AdminEvent => Boolean(e));
    const eventLites = events.map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt,
      priceMxn: e.priceMxn,
    }));

    const derived = deriveContactActivities({
      email,
      waitlist,
      prospect,
      participations,
      events: eventLites,
    });
    const timeline = buildContactTimeline({ activities, derived });
    const stats = buildContactStats({
      email,
      prospect,
      waitlist,
      participations,
      events: eventLites,
      activities: timeline,
    });

    return NextResponse.json({
      ok: true,
      email,
      prospect,
      waitlist: waitlist
        ? {
            id: waitlist.id,
            fullName: waitlist.fullName,
            email: waitlist.email,
            company: waitlist.company,
            createdAt: waitlist.createdAt,
            deletedAt: waitlist.deletedAt ?? null,
            city: waitlist.city,
            sector: waitlist.sector,
            position: waitlist.position,
          }
        : null,
      stats,
      timeline,
    });
  } catch (error) {
    console.error("[admin/contacts/by-email]", error);
    return NextResponse.json({ ok: false, error: "load_failed" }, { status: 502 });
  }
}
