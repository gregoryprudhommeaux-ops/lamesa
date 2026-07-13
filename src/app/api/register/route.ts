import { NextResponse } from "next/server";
import { registrationSchema } from "@/lib/validation";
import { isDatabasePersoConfigured, upsertContact } from "@/lib/database-perso";
import { sendWaitlistConfirmationEmail } from "@/lib/email/send-waitlist-confirmation";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { normalizeEmail } from "@/lib/auth/platform-admin";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const data = parsed.data;
  if (data.website) {
    return NextResponse.json({ ok: true });
  }

  const record = {
    fullName: data.fullName,
    linkedinUrl: data.linkedinUrl,
    email: normalizeEmail(data.email),
    company: data.company,
    sector: data.sector,
    position: data.position,
    extraActivities: data.extraActivities,
    city: data.city,
    phone: data.phone,
    invitationMotivation: data.invitationMotivation,
    locale: data.locale,
    source: "la-mesa-registration",
    tags: ["la-mesa", "waitlist", "guadalajara"],
    createdAt: new Date().toISOString(),
  };

  let storedId: string | undefined;

  if (isFirebaseAdminConfigured()) {
    try {
      const db = getAdminFirestore();
      const ref = await db.collection(COLLECTIONS.waitlist).add(record);
      storedId = ref.id;
    } catch (error) {
      console.error("[register] Firestore error:", error);
    }
  }

  if (isDatabasePersoConfigured()) {
    try {
      const notes = [
        `LinkedIn: ${data.linkedinUrl}`,
        `Secteur: ${data.sector}`,
        `Poste: ${data.position}`,
        `Activités: ${data.extraActivities.join(", ")}`,
        `Ville: ${data.city}`,
        `Motivation: ${data.invitationMotivation}`,
      ].join("\n");

      const result = await upsertContact({
        fullName: data.fullName,
        linkedinUrl: data.linkedinUrl,
        emails: [data.email],
        phones: [data.phone],
        company: data.company,
        sector: data.sector,
        position: data.position,
        extraActivities: data.extraActivities,
        city: data.city,
        tags: record.tags,
        source: record.source,
        locale: data.locale,
        notes,
      });

      if (result.id) storedId = result.id;
    } catch (error) {
      console.error("[register] Database Perso error:", error);
      if (!storedId && process.env.NODE_ENV === "production") {
        return NextResponse.json({ ok: false, error: "storage_failed" }, { status: 502 });
      }
    }
  }

  if (!storedId && process.env.NODE_ENV === "development") {
    console.info("[register] dev fallback — registration logged:", record);
    return NextResponse.json({ ok: true, dev: true });
  }

  if (!storedId) {
    return NextResponse.json({ ok: false, error: "storage_not_configured" }, { status: 503 });
  }

  const mail = await sendWaitlistConfirmationEmail({
    to: record.email,
    fullName: record.fullName,
    locale: record.locale,
  });
  if (!mail.ok) {
    console.warn("[register] confirmation email skipped/failed:", mail.error);
  }

  return NextResponse.json({ ok: true, id: storedId, emailSent: mail.ok });
}
