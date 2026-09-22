import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { buildAddToCalendarIcs, buildCalendarInviteIcs, eventCalendarInviteUid } from "@/lib/email/ics";
import { buildRsvpClickUrl } from "@/lib/email/rsvp-links";
import { signRsvpToken } from "@/lib/email/rsvp-token";
import { brevoFromAddress, sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  applyTemplateVars,
  buildEventTemplateVars,
  resolveTemplateLocale,
  type TemplateVars,
} from "@/lib/email/templates";
import { wrapLaMesaPlainBody, wrapLaMesaEmailHtml, laMesaEmailFooterText } from "@/lib/email/la-mesa-email-shell";
import { inviteBodyToHtml, rsvpYesNoButtonsHtml } from "@/lib/email/send-calendar-invite";
import { formatEventWhereLine } from "@/lib/events/format-where";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { emailPublicBaseUrl } from "@/lib/site-url";
import type { AdminEvent, AdminEventParticipation, EmailTemplateKey, TemplateLocale } from "@/lib/types/events";
import { z } from "zod";

const schema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(50_000),
  locale: z.enum(["fr", "es", "en"]).optional(),
  eventId: z.string().trim().min(1).max(80).optional().nullable(),
  /** When calendar_invite / payment_relance / places_available / save_the_date, attach a real .ics. */
  templateKey: z.string().trim().min(1).max(80).optional().nullable(),
  /** Optional override; defaults to the logged-in admin email. */
  to: z.string().email().optional(),
});

function buildTestRsvpUrls(input: {
  locale: TemplateLocale;
  email: string;
  eventId: string;
  participationId: string;
}): { yesUrl: string; noUrl: string } {
  const token = signRsvpToken({
    participationId: input.participationId,
    eventId: input.eventId,
    email: input.email,
  });
  const baseUrl = emailPublicBaseUrl();
  return {
    yesUrl: buildRsvpClickUrl({
      token,
      response: "yes",
      locale: input.locale,
      baseUrl,
    }),
    noUrl: buildRsvpClickUrl({
      token,
      response: "no",
      locale: input.locale,
      baseUrl,
    }),
  };
}

function sampleVars(
  locale: TemplateLocale,
  rsvp: { yesUrl: string; noUrl: string },
): TemplateVars {
  const base = emailPublicBaseUrl();
  return {
    fullName: "Test LA MESA",
    firstName: "Test",
    email: "test@example.com",
    eventTitle: "LA MESA — aperçu test",
    when: locale === "en" ? "Fri, Sep 25, 2026, 07:30 PM" : "ven. 25 sept. 2026, 19:30",
    where: "Venue test · Guadalajara",
    wherePublic: "Chapultepec, Guadalajara",
    registerUrl: `${base}/light`,
    eventUrl: `${base}/${locale}/e/demo`,
    yesUrl: rsvp.yesUrl,
    noUrl: rsvp.noUrl,
    surveyUrl: `${base}/${locale}/survey/demo`,
    priceBeforeTax: "$450.00 MXN",
    ivaAmount: "$72.00 MXN",
    totalWithIva: "$522.00 MXN",
    accessIncludes: "Welcome drink",
    menuIncluded: locale === "fr" ? "Menu test (entrée + plat)" : "Menú de prueba",
    format: locale === "fr" ? "Dîner" : locale === "en" ? "Dinner" : "Cena",
    paymentDeadline: locale === "fr" ? "23 septembre 2026" : "September 23, 2026",
    paymentDeadlineBlock:
      locale === "fr"
        ? "Important — règlement ACCESS :\nTa place ne sera validée que si le ticket ACCESS est réglé au plus tard le 23 septembre 2026 à 19h."
        : "Important — ACCESS payment:\nYour spot will only be confirmed once paid by September 23, 2026 at 7pm.",
    seatScarcityBlock:
      locale === "fr"
        ? "Places limitées — premier arrivé, premier servi (selon le règlement)."
        : "Limited seats — first come, first served (by payment).",
  };
}

function buildTestIcsAttachment(input: {
  templateKey: string | null | undefined;
  event: AdminEvent | null;
  to: string;
  bodyText: string;
}): { name: string; content: string } | null {
  const key = (input.templateKey ?? "").trim() as EmailTemplateKey | "";
  if (
    key !== "calendar_invite" &&
    key !== "payment_relance" &&
    key !== "places_available" &&
    key !== "save_the_date"
  ) {
    return null;
  }

  const from = brevoFromAddress();
  const startsAt =
    input.event?.startsAt && !Number.isNaN(Date.parse(input.event.startsAt))
      ? input.event.startsAt
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const endsAt = input.event?.endsAt;
  const title = input.event?.title
    ? `LA MESA — ${input.event.title}`
    : "LA MESA — aperçu test";
  const location = input.event
    ? formatEventWhereLine(
        input.event.publicAreaHint || input.event.venueName,
        input.event.publicAreaHint ? null : input.event.address,
      )
    : "À préciser";
  const uid = input.event?.id
    ? eventCalendarInviteUid(input.event.id)
    : `test-${key}-demo-${Date.now()}@lamesa`;

  const ics =
    key === "save_the_date"
      ? buildAddToCalendarIcs({
          uid,
          title,
          description: input.bodyText.slice(0, 1500),
          location,
          startsAt,
          endsAt,
          organizerEmail: from.email,
          organizerName: input.event?.organizerName ?? from.name ?? "LA MESA",
        })
      : buildCalendarInviteIcs({
          uid,
          title,
          description: input.bodyText.slice(0, 1500),
          location,
          startsAt,
          endsAt,
          organizerEmail: from.email,
          organizerName: input.event?.organizerName ?? from.name ?? "LA MESA",
          attendeeEmail: input.to,
          attendeeName: "Test LA MESA",
          url: input.event
            ? `${emailPublicBaseUrl()}/e/${input.event.slug ?? input.event.id}`
            : undefined,
          requestRsvp: false,
        });

  return {
    name: key === "save_the_date" ? "la-mesa-save-the-date.ics" : "la-mesa-invite.ics",
    content: Buffer.from(ics, "utf8").toString("base64"),
  };
}

/** Ensure the test recipient has a participation so YES/NO tokens resolve. */
async function ensureTestParticipation(input: {
  eventId: string;
  email: string;
  fullName: string;
}): Promise<AdminEventParticipation> {
  const db = getAdminFirestore();
  const email = normalizeEmail(input.email);
  const existing = await db
    .collection(COLLECTIONS.participations)
    .where("eventId", "==", input.eventId)
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!existing.empty) {
    const d = existing.docs[0]!;
    return { id: d.id, ...(d.data() as Omit<AdminEventParticipation, "id">) };
  }
  const now = new Date().toISOString();
  const ref = await db.collection(COLLECTIONS.participations).add({
    eventId: input.eventId,
    email,
    fullName: input.fullName,
    status: "invited",
    statusSource: "admin",
    createdAt: now,
    updatedAt: now,
  });
  return {
    id: ref.id,
    eventId: input.eventId,
    email,
    fullName: input.fullName,
    status: "invited",
    statusSource: "admin",
  };
}

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const locale = resolveTemplateLocale(parsed.data.locale);
  const to = (parsed.data.to ?? admin.email).trim().toLowerCase();
  if (!to.includes("@")) {
    return NextResponse.json({ ok: false, error: "no_admin_email" }, { status: 400 });
  }

  let event: AdminEvent | null = null;
  let participationId = `test-${Date.now()}`;
  let eventIdForToken = "test-event";

  if (parsed.data.eventId && isFirebaseAdminConfigured()) {
    try {
      const db = getAdminFirestore();
      const snap = await db.collection(COLLECTIONS.events).doc(parsed.data.eventId).get();
      if (snap.exists) {
        event = { id: snap.id, ...(snap.data() as Omit<AdminEvent, "id">) } as AdminEvent;
        const part = await ensureTestParticipation({
          eventId: event.id,
          email: to,
          fullName: "Test LA MESA",
        });
        participationId = part.id;
        eventIdForToken = event.id;
      }
    } catch (error) {
      console.warn("[email-templates/send-test] event load failed", error);
    }
  }

  const rsvp = buildTestRsvpUrls({
    locale,
    email: to,
    eventId: eventIdForToken,
    participationId,
  });

  let vars = sampleVars(locale, rsvp);
  if (event) {
    const base = emailPublicBaseUrl();
    vars = {
      ...buildEventTemplateVars({
        event,
        publicBaseUrl: base,
        fullName: "Test LA MESA",
        email: to,
        locale,
        yesUrl: rsvp.yesUrl,
        noUrl: rsvp.noUrl,
        surveyUrl: `${base}/${locale}/survey/demo`,
      }),
    };
  }

  const subject = `[TEST] ${applyTemplateVars(parsed.data.subject, vars)}`;
  const bodyText = applyTemplateVars(parsed.data.body, vars);
  const templateKey = (parsed.data.templateKey ?? "").trim();
  const wantsRsvpButtons =
    templateKey === "places_available" ||
    templateKey === "calendar_invite" ||
    bodyText.includes(rsvp.yesUrl) ||
    bodyText.includes("{{yesUrl}}") ||
    /YES\s*:/i.test(parsed.data.body);

  const html = wantsRsvpButtons
    ? wrapLaMesaEmailHtml({
        lang: locale,
        bodyHtml: inviteBodyToHtml(bodyText, rsvp.yesUrl, rsvp.noUrl, vars.eventUrl ?? ""),
        footerHtml: rsvpYesNoButtonsHtml({
          yesUrl: rsvp.yesUrl,
          noUrl: rsvp.noUrl,
          locale,
        }),
      })
    : wrapLaMesaPlainBody(bodyText, { lang: locale });
  const attachment = buildTestIcsAttachment({
    templateKey: parsed.data.templateKey,
    event,
    to,
    bodyText,
  });

  const result = await sendTransactionalEmail({
    to,
    subject,
    html,
    text: `${bodyText}\n\n${laMesaEmailFooterText(locale)}`,
    bccAdmins: false,
    ...(attachment ? { attachments: [attachment] } : {}),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    to,
    subject,
    attachedIcs: Boolean(attachment),
  });
}
