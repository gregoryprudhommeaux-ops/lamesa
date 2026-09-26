import { NextResponse } from "next/server";
import { verifyRsvpToken } from "@/lib/email/rsvp-token";
import { sendAdminRsvpYesEmail } from "@/lib/email/send-admin-rsvp-yes";
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

function rsvpOkRedirect(input: {
  base: string;
  locale: string;
  response: string;
  eventTitle?: string;
  eventWhen?: string;
  payBy?: string;
  status?: string;
}) {
  const q = new URLSearchParams({
    status: input.status ?? "ok",
    response: input.response,
  });
  if (input.eventTitle) q.set("title", input.eventTitle);
  if (input.eventWhen) q.set("when", input.eventWhen);
  if (input.payBy) q.set("payBy", input.payBy);
  return NextResponse.redirect(`${input.base}/${input.locale}/rsvp?${q.toString()}`);
}

/**
 * Shared RSVP handler for /api/rsvp/go and /api/rsvp/[token].
 */
export async function processRsvpClick(input: {
  token: string;
  response: string;
  locale: string;
  requestUrl: string;
}): Promise<NextResponse> {
  const response = String(input.response ?? "").toLowerCase();
  const locale = String(input.locale ?? "fr").slice(0, 2);
  const base = getSiteUrl(input.requestUrl);

  const redirect = (status: string, rsvp?: string) => {
    const q = new URLSearchParams({ status });
    if (rsvp) q.set("response", rsvp);
    return NextResponse.redirect(`${base}/${locale}/rsvp?${q.toString()}`);
  };

  if (response !== "yes" && response !== "no") {
    return redirect("invalid");
  }

  const payload = verifyRsvpToken(input.token);
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
      fullName?: string;
      companyName?: string;
      phone?: string;
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
    const eventWhen = event?.startsAt ? fmtDateTime(event.startsAt, eventLang) : "";
    const payBy = event?.paymentDeadlineAt
      ? formatPaymentDeadlineDate(event.paymentDeadlineAt, eventLang)
      : "";

    const current = normalizeParticipationStatus(data.status);
    let next = response === "yes" ? "attending" : "not_attending";

    const okRedirect = (status = "ok") =>
      rsvpOkRedirect({
        base,
        locale: eventLang,
        response,
        eventTitle,
        eventWhen,
        payBy: response === "yes" ? payBy : undefined,
        status,
      });

    if (response === "yes" && current === "confirmed") {
      return okRedirect();
    }
    if (current === next) {
      return okRedirect();
    }

    // Waitlist may still answer: YES stays / promotes if seat; NO declines.
    if (current === "waitlist" && response === "yes" && event) {
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
      next = seated < capacity ? "attending" : "waitlist";
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
    const guestName = String(data.fullName ?? "").trim() || guestEmail;
    if (guestEmail.includes("@")) {
      void import("@/lib/contacts/activities-store").then(({ recordContactActivity }) =>
        recordContactActivity({
          email: guestEmail,
          type: response === "yes" ? "rsvp_yes" : "rsvp_no",
          source: "guest",
          summary:
            response === "yes"
              ? `RSVP oui · ${eventTitle || payload.eventId}`
              : `Refus · ${eventTitle || payload.eventId}`,
          refs: {
            eventId: payload.eventId,
            participationId: payload.participationId,
          },
        }),
      );
    }

    if (response === "yes" && guestEmail.includes("@")) {
      void sendAdminRsvpYesEmail({
        fullName: guestName,
        email: guestEmail,
        company: data.companyName,
        phone: data.phone,
        eventTitle: eventTitle || payload.eventId,
        eventSlug: event?.slug,
        channel: "rsvp_button",
        status: next,
      }).then((adminMail) => {
        if (!adminMail.ok) {
          console.error("[rsvp] admin OUI notify FAILED:", adminMail.error, {
            to: "gregory.prudhommeaux@gmail.com",
            email: guestEmail,
          });
        } else {
          console.info("[rsvp] admin OUI notify sent", { email: guestEmail });
        }
      });
    }

    // Non-members must create a LA MESA account (YES or NO).
    if (event && guestEmail.includes("@")) {
      const waitlist = await findWaitlistByEmail(guestEmail);
      // Stub outreach rows have profileComplete === false → must register on /light.
      const onMesa = Boolean(waitlist) && waitlist?.profileComplete !== false;
      if (!onMesa) {
        const q = new URLSearchParams({
          from: "places",
          event: event.slug || event.id,
          rsvp: response,
        });
        return NextResponse.redirect(`${base}/light?${q.toString()}`);
      }
    }

    // Payment copy stays on the formal invite and the RSVP page.
    // payment_relance is a manual follow-up from the payment phase, once per guest.
    if (response === "yes" && next === "waitlist") {
      return okRedirect("waitlist");
    }

    return okRedirect();
  } catch (error) {
    console.error("[rsvp]", error);
    return redirect("error");
  }
}
