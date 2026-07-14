import { NextResponse } from "next/server";
import { verifyRsvpToken } from "@/lib/email/rsvp-token";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import type { AdminEvent } from "@/lib/types/events";

type Params = { params: Promise<{ token: string }> };

function siteUrl(request: Request): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  try {
    return new URL(request.url).origin;
  } catch {
    return "http://127.0.0.1:3000";
  }
}

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  const url = new URL(request.url);
  const response = String(url.searchParams.get("response") ?? "").toLowerCase();
  const locale = String(url.searchParams.get("locale") ?? "fr").slice(0, 2);
  const base = siteUrl(request);

  const redirect = (status: string, rsvp?: string) => {
    const q = new URLSearchParams({ status });
    if (rsvp) q.set("response", rsvp);
    return NextResponse.redirect(`${base}/${locale}/rsvp?${q.toString()}`);
  };

  if (response !== "yes" && response !== "no") {
    return redirect("invalid");
  }

  const payload = verifyRsvpToken(token);
  if (!payload) {
    return redirect("invalid");
  }

  if (!isFirebaseAdminConfigured()) {
    return redirect("error");
  }

  try {
    const db = getAdminFirestore();
    const ref = db.collection(COLLECTIONS.participations).doc(payload.participationId);
    const snap = await ref.get();
    if (!snap.exists) {
      return redirect("not_found");
    }

    const data = snap.data() as {
      eventId?: string;
      email?: string;
      status?: string;
    };
    if (data.eventId !== payload.eventId) {
      return redirect("invalid");
    }

    const eventSnap = await db.collection(COLLECTIONS.events).doc(payload.eventId).get();
    const eventLang =
      eventSnap.exists && (eventSnap.data() as AdminEvent)?.eventLanguage
        ? (eventSnap.data() as AdminEvent).eventLanguage!
        : locale;

    const current = normalizeParticipationStatus(data.status);
    const next = response === "yes" ? "attending" : "not_attending";

    // Idempotent: already at target, or confirmed stays confirmed on YES
    if (current === next) {
      return NextResponse.redirect(
        `${base}/${eventLang}/rsvp?status=ok&response=${response}`,
      );
    }
    if (response === "yes" && current === "confirmed") {
      return NextResponse.redirect(
        `${base}/${eventLang}/rsvp?status=ok&response=yes`,
      );
    }
    // Don't override confirmed → not_attending unless explicit NO from invite (allow)
    // Don't move waitlist via RSVP
    if (current === "waitlist") {
      return NextResponse.redirect(
        `${base}/${eventLang}/rsvp?status=invalid&response=${response}`,
      );
    }

    const now = new Date().toISOString();
    await ref.set(
      {
        status: next,
        statusSource: "guest",
        rsvpAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    return NextResponse.redirect(
      `${base}/${eventLang}/rsvp?status=ok&response=${response}`,
    );
  } catch (error) {
    console.error("[rsvp]", error);
    return redirect("error");
  }
}
