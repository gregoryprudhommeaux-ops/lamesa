import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import {
  findWaitlistByEmail,
  findWaitlistByEmailIncludingDeleted,
  findWaitlistByReferralCode,
} from "@/lib/auth/member.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { sendAdminNewRegistrationEmail } from "@/lib/email/send-admin-new-registration";
import { sendWaitlistConfirmationEmail } from "@/lib/email/send-waitlist-confirmation";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { syncWaitlistMemberToDatabasePerso } from "@/lib/member/sync-database-perso";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import {
  isValidReferralCodeFormat,
  normalizeReferralCode,
} from "@/lib/member/referral-code";
import { registrationSchema } from "@/lib/validation";

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

  const email = normalizeEmail(data.email);
  const now = new Date().toISOString();

  if (isFirebaseAdminConfigured()) {
    const active = await findWaitlistByEmail(email);
    if (active) {
      return NextResponse.json({ ok: false, error: "already_registered" }, { status: 409 });
    }
  }

  let referredByCode: string | undefined;
  let referredById: string | undefined;
  let referralAcceptedAt: string | undefined;

  if (data.referralCode && isValidReferralCodeFormat(data.referralCode)) {
    const code = normalizeReferralCode(data.referralCode);
    const sponsor = await findWaitlistByReferralCode(code);
    if (sponsor) {
      referredByCode = code;
      referredById = sponsor.id;
      referralAcceptedAt = now;
    }
  }

  const record = {
    fullName: data.fullName,
    linkedinUrl: data.linkedinUrl,
    email,
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
    createdAt: now,
    ...(referredByCode
      ? { referredByCode, referredById, referralAcceptedAt }
      : {}),
  };

  let storedId: string | undefined;

  if (isFirebaseAdminConfigured()) {
    try {
      const db = getAdminFirestore();
      const existing = await findWaitlistByEmailIncludingDeleted(email);

      if (existing && isSoftDeleted(existing)) {
        const { createdAt: _ignored, ...updates } = record;
        await db.collection(COLLECTIONS.waitlist).doc(existing.id).set(
          {
            ...updates,
            deletedAt: FieldValue.delete(),
            updatedAt: now,
          },
          { merge: true },
        );
        storedId = existing.id;
      } else {
        const ref = await db.collection(COLLECTIONS.waitlist).add(record);
        storedId = ref.id;
      }
    } catch (error) {
      console.error("[register] Firestore error:", error);
    }
  }

  if (isFirebaseAdminConfigured() && storedId) {
    const sync = await syncWaitlistMemberToDatabasePerso(
      {
        ...record,
        referredByCode,
      },
      "[register]",
    );
    if (sync.id) {
      try {
        await getAdminFirestore()
          .collection(COLLECTIONS.waitlist)
          .doc(storedId)
          .set(
            {
              databasePersoContactId: sync.id,
              databasePersoSyncedAt: new Date().toISOString(),
            },
            { merge: true },
          );
      } catch (error) {
        console.warn("[register] failed to store databasePersoContactId:", error);
      }
    }
  } else {
    await syncWaitlistMemberToDatabasePerso(
      { ...record, referredByCode },
      "[register]",
    );
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

  const adminMail = await sendAdminNewRegistrationEmail({
    fullName: record.fullName,
    email: record.email,
    company: record.company,
    sector: record.sector,
    position: record.position,
    city: record.city,
    phone: record.phone,
    linkedinUrl: record.linkedinUrl,
    locale: record.locale,
    invitationMotivation: record.invitationMotivation,
    variant: "full",
    ...(referredByCode ? { referredByCode } : {}),
  });
  if (!adminMail.ok) {
    console.warn("[register] admin notify skipped/failed:", adminMail.error);
  }

  return NextResponse.json({ ok: true, id: storedId, emailSent: mail.ok });
}
