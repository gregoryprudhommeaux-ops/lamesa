import { NextResponse } from "next/server";
import { verifyRsvpToken } from "@/lib/email/rsvp-token";
import { sendTemplatedEventEmail } from "@/lib/email/send-calendar-invite";
import {
  countSeatedParticipations,
  DEFAULT_GUEST_CAPACITY,
} from "@/lib/events/capacity";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { findWaitlistByEmail } from "@/lib/auth/member.server";
import { normalizeParticipationStatus } from "@/lib/events/participation-status";
import { formatPaymentDeadlineDate } from "@/lib/events/payment-details";
import { fmtDateTime } from "@/lib/events/utils";
import { getSiteUrl } from "@/lib/site-url";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";

type Params = { params: Promise<{ token: string }> };

function rsvpOkRedirect(input: {
  base: string;
  locale: string;
  response: string;
  eventTitle?: string;
  eventWhen?: string;
  payBy?: string;
}) {
  const q = new URLSearchParams({
    status: "ok",
    response: input.response,
  });
  if (input.eventTitle) q.set("title", input.eventTitle);
  if (input.eventWhen) q.set("when", input.eventWhen);
  if (input.payBy) q.set("payBy", input.payBy);
  return NextResponse.redirect(`${input.base}/${input.locale}/rsvp?${q.toString()}`);
}

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  const url = new URL(request.url);
  const response = String(url.searchParams.get("response") ?? "").toLowerCase();
  const locale = String(url.searchParams.get("locale") ?? "fr").slice(0, 2);
  const base = getSiteUrl(request.url);

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
    const event = eventSnap.exists
      ? ({ id: eventSnap.id, ...(eventSnap.data() as Omit<AdminEvent, "id">) } as AdminEvent)
      : null;
    const eventLang =
      event?.eventLanguage === "fr" || event?.eventLanguage === "en" || event?.eventLanguage === "es"
        ? event.eventLanguage
        : (locale as "fr" | "en" | "es");
    const eventTitle = event?.title?.trim() || "";
    const eventWhen = event?.startsAt
      ? fmtDateTime(event.startsAt, eventLang)
      : "";
    const payBy = event?.paymentDeadlineAt
      ? formatPaymentDeadlineDate(event.paymentDeadlineAt, eventLang)
      : "";

    const current = normalizeParticipationStatus(data.status);
    const next = response === "yes" ? "attending" : "not_attending";

    const okRedirect = () =>
      rsvpOkRedirect({
        base,
        locale: eventLang,
        response,
        eventTitle,
        eventWhen,
        payBy: response === "yes" ? payBy : undefined,
      });

    // Idempotent: already at target, or confirmed stays confirmed on YES
    if (current === next) {
      return okRedirect();
    }
    if (response === "yes" && current === "confirmed") {
      return okRedirect();
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

    const guestEmail = String(data.email ?? "").trim();
    if (guestEmail.includes("@")) {
      void import("@/lib/contacts/activities-store").then(({ recordContactActivity }) =>
        recordContactActivity({
          email: guestEmail,
          type: response === "yes" ? "rsvp_yes" : "rsvp_no",
          source: "guest",
          summary: response === "yes" ? `RSVP oui · ${eventTitle || payload.eventId}` : `Refus · ${eventTitle || payload.eventId}`,
          refs: {
            eventId: payload.eventId,
            participationId: payload.participationId,
          },
        }),
      );
    }

    // Places-available / formal YES → payment coords if seats remain + member on waitlist.
    if (response === "yes" && event && guestEmail.includes("@")) {
      try {
        const partsSnap = await db
          .collection(COLLECTIONS.participations)
          .where("eventId", "==", payload.eventId)
          .limit(500)
          .get();
        const parts = partsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AdminEventParticipation, "id">),
        }));
        const capacity =
          typeof event.capacity === "number" && event.capacity > 0
            ? event.capacity
            : DEFAULT_GUEST_CAPACITY;
        const seated = countSeatedParticipations(parts);
        const partRow = parts.find((p) => p.id === payload.participationId);
        const waitlist = await findWaitlistByEmail(guestEmail);
        const onMesa = Boolean(waitlist) && waitlist?.profileComplete !== false;
        const seatsLeft = seated <= capacity;

        if (!onMesa) {
          return NextResponse.redirect(
            `${base}/light?from=places&event=${encodeURIComponent(event.slug || event.id)}`,
          );
        }
        if (seatsLeft && partRow && normalizeParticipationStatus(partRow.status) !== "confirmed") {
          void sendTemplatedEventEmail({
            key: "payment_relance",
            event,
            participation: partRow,
          }).catch((err) => console.error("[rsvp] payment_relance after yes", err));
        }
      } catch (err) {
        console.error("[rsvp] post-yes follow-up", err);
      }
    }

    return okRedirect();
  } catch (error) {
    console.error("[rsvp]", error);
    return redirect("error");
  }
}
