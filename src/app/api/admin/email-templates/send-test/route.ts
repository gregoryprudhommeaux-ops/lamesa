import { NextResponse } from "next/server";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { buildAddToCalendarIcs, buildCalendarInviteIcs, eventCalendarInviteUid } from "@/lib/email/ics";
import { primaryOrganizerEmail } from "@/lib/email/event-mail-addressing";
import { brevoFromAddress, sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  applyTemplateVars,
  buildEventTemplateVars,
  resolveTemplateLocale,
  type TemplateVars,
} from "@/lib/email/templates";
import { wrapLaMesaPlainBody, laMesaEmailFooterText } from "@/lib/email/la-mesa-email-shell";
import { formatEventWhereLine } from "@/lib/events/format-where";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getSiteUrl } from "@/lib/site-url";
import type { AdminEvent, EmailTemplateKey, TemplateLocale } from "@/lib/types/events";
import { z } from "zod";

const schema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(50_000),
  locale: z.enum(["fr", "es", "en"]).optional(),
  eventId: z.string().trim().min(1).max(80).optional().nullable(),
  /** When calendar_invite / save_the_date, attach a real .ics for the test. */
  templateKey: z.string().trim().min(1).max(80).optional().nullable(),
  /** Optional override; defaults to the logged-in admin email. */
  to: z.string().email().optional(),
});

function sampleVars(locale: TemplateLocale): TemplateVars {
  return {
    fullName: "Test LA MESA",
    firstName: "Test",
    email: "test@example.com",
    eventTitle: "LA MESA — aperçu test",
    when: locale === "en" ? "Fri, Sep 25, 2026, 07:30 PM" : "ven. 25 sept. 2026, 19:30",
    where: "Venue test · Guadalajara",
    eventUrl: `${getSiteUrl()}/${locale}/e/demo`,
    yesUrl: `${getSiteUrl()}/api/rsvp/demo?response=yes&locale=${locale}`,
    noUrl: `${getSiteUrl()}/api/rsvp/demo?response=no&locale=${locale}`,
    surveyUrl: `${getSiteUrl()}/${locale}/survey/demo`,
    priceBeforeTax: "$450.00 MXN",
    ivaAmount: "$72.00 MXN",
    totalWithIva: "$522.00 MXN",
    accessIncludes: locale === "fr" ? "Welcome drink" : "Welcome drink",
    menuIncluded: locale === "fr" ? "Menu test (entrée + plat)" : "Menú de prueba",
    format: locale === "fr" ? "Dîner" : locale === "en" ? "Dinner" : "Cena",
    paymentDeadline: locale === "fr" ? "20 septembre 2026" : "September 20, 2026",
    paymentDeadlineBlock:
      locale === "fr"
        ? "Important — règlement ACCESS :\nTa place ne sera validée que si le ticket ACCESS est réglé au plus tard le 20 septembre 2026."
        : "Important — ACCESS payment:\nYour spot will only be confirmed once paid by September 20, 2026.",
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
  if (key !== "calendar_invite" && key !== "save_the_date") return null;

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
    ? formatEventWhereLine(input.event.venueName, input.event.address)
    : "À préciser";
  const uid = input.event?.id
    ? eventCalendarInviteUid(input.event.id)
    : `test-${key}-demo-${Date.now()}@lamesa`;
  const organizerEmail = primaryOrganizerEmail();

  const ics =
    key === "calendar_invite"
      ? buildCalendarInviteIcs({
          uid,
          title,
          description: input.bodyText.slice(0, 1500),
          location,
          startsAt,
          endsAt,
          organizerEmail,
          organizerName: input.event?.organizerName ?? from.name ?? "LA MESA",
          sentByEmail: from.email,
          attendeeEmail: input.to,
          attendeeName: "Test LA MESA",
          url: input.event ? `${getSiteUrl()}/e/${input.event.slug ?? input.event.id}` : undefined,
          requestRsvp: false,
        })
      : buildAddToCalendarIcs({
          uid,
          title,
          description: input.bodyText.slice(0, 1500),
          location,
          startsAt,
          endsAt,
          organizerEmail,
          organizerName: input.event?.organizerName ?? from.name ?? "LA MESA",
        });

  return {
    name: key === "calendar_invite" ? "la-mesa-invite.ics" : "la-mesa-save-the-date.ics",
    content: Buffer.from(ics, "utf8").toString("base64"),
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

  let vars = sampleVars(locale);
  let event: AdminEvent | null = null;
  if (parsed.data.eventId && isFirebaseAdminConfigured()) {
    try {
      const db = getAdminFirestore();
      const snap = await db.collection(COLLECTIONS.events).doc(parsed.data.eventId).get();
      if (snap.exists) {
        event = { id: snap.id, ...(snap.data() as Omit<AdminEvent, "id">) } as AdminEvent;
        const base = getSiteUrl();
        vars = {
          ...buildEventTemplateVars({
            event,
            publicBaseUrl: base,
            fullName: "Test LA MESA",
            email: to,
            locale,
            yesUrl: `${base}/api/rsvp/demo?response=yes&locale=${locale}`,
            noUrl: `${base}/api/rsvp/demo?response=no&locale=${locale}`,
            surveyUrl: `${base}/${locale}/survey/demo`,
          }),
        };
      }
    } catch (error) {
      console.warn("[email-templates/send-test] event load failed", error);
    }
  }

  const subject = `[TEST] ${applyTemplateVars(parsed.data.subject, vars)}`;
  const bodyText = applyTemplateVars(parsed.data.body, vars);
  const html = wrapLaMesaPlainBody(bodyText, { lang: locale });
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
