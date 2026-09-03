import { NextResponse } from "next/server";
import { isPlatformAdminIdentity, normalizeEmail } from "@/lib/auth/platform-admin";
import {
  findWaitlistByEmail,
  linkWaitlistUid,
  requireVerifiedUser,
} from "@/lib/auth/member.server";
import { sendInterestAckEmail } from "@/lib/email/send-interest-ack";
import {
  eventInterestSchema,
  isInterestDeadlinePassed,
  splitFullName,
} from "@/lib/events/event-interest";
import { syncInterestRespondentToProspectLists } from "@/lib/events/sync-interest-to-prospect-lists";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEvent } from "@/lib/types/events";

type Params = { params: Promise<{ slug: string }> };

function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export async function POST(request: Request, { params }: Params) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const user = await requireVerifiedUser(request);
  if (isNextResponse(user)) return user;

  const email = normalizeEmail(user.email!);
  let waitlist = await findWaitlistByEmail(email);

  if (!waitlist) {
    if (isPlatformAdminIdentity({ email })) {
      return NextResponse.json({ ok: false, error: "no_profile" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "not_on_waitlist" }, { status: 403 });
  }

  if (!waitlist.uid) {
    await linkWaitlistUid(waitlist.id, user.uid);
    waitlist = { ...waitlist, uid: user.uid };
  } else if (waitlist.uid !== user.uid && !isPlatformAdminIdentity({ email })) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = eventInterestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        error: issue?.message ?? "validation",
        field: issue?.path?.[0] ? String(issue.path[0]) : undefined,
      },
      { status: 400 },
    );
  }

  const db = getAdminFirestore();
  const eventSnap = await db
    .collection(COLLECTIONS.events)
    .where("slug", "==", slug)
    .where("status", "==", "published")
    .limit(1)
    .get();

  if (eventSnap.empty) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const eventDoc = eventSnap.docs[0]!;
  const eventData = eventDoc.data();
  const responseMode = eventData.responseMode === "interest" ? "interest" : "rsvp";
  if (responseMode !== "interest") {
    return NextResponse.json({ ok: false, error: "not_interest_mode" }, { status: 400 });
  }

  if (isInterestDeadlinePassed(eventData.interestDeadlineAt as string | null | undefined)) {
    return NextResponse.json({ ok: false, error: "deadline_passed" }, { status: 403 });
  }

  const data = parsed.data;
  const { firstName, lastName } = splitFullName(waitlist.fullName || email);
  const now = new Date().toISOString();

  const attendance =
    data.interestResponse === "yes"
      ? "yes"
      : data.interestResponse === "no"
        ? "no"
        : "other";

  const payload = {
    eventId: eventDoc.id,
    firstName,
    lastName,
    email,
    companyName: waitlist.company ?? "",
    whatsapp: waitlist.phone ?? "",
    jobTitle: waitlist.position ?? "",
    comments: data.ideasComment?.trim() || "",
    attendance,
    interestResponse: data.interestResponse,
    declineReason:
      data.interestResponse === "no" ? (data.declineReason ?? null) : null,
    declineReasonOther: data.declineReasonOther?.trim() || null,
    expectations:
      data.interestResponse === "yes" ? (data.expectations?.trim() || null) : null,
    ideasComment: data.ideasComment?.trim() || null,
    frenchFounderAttested: true,
    profilePending: false,
    waitlistId: waitlist.id,
    updatedAt: now,
  };

  const existingSnap = await db
    .collection(COLLECTIONS.respondents)
    .where("eventId", "==", eventDoc.id)
    .limit(500)
    .get();

  const existingDoc = existingSnap.docs.find(
    (d) => normalizeEmail(String(d.data().email ?? "")) === email,
  );

  let id: string;
  let respondentRef = existingDoc?.ref;
  if (existingDoc) {
    id = existingDoc.id;
    await existingDoc.ref.set(payload, { merge: true });
  } else {
    const ref = await db.collection(COLLECTIONS.respondents).add({
      ...payload,
      createdAt: now,
    });
    id = ref.id;
    respondentRef = ref;
  }

  const event: AdminEvent = {
    id: eventDoc.id,
    ...(eventData as Omit<AdminEvent, "id">),
  };

  const mail = await sendInterestAckEmail({
    event,
    email,
    fullName: waitlist.fullName || `${firstName} ${lastName}`.trim(),
    interestResponse: data.interestResponse,
    declineReason: payload.declineReason,
    declineReasonOther: payload.declineReasonOther,
    expectations: payload.expectations,
    ideasComment: payload.ideasComment,
  });

  const listSync = await syncInterestRespondentToProspectLists({
    eventSlug: slug,
    email,
    fullName: waitlist.fullName || `${firstName} ${lastName}`.trim(),
    company: waitlist.company,
    phone: waitlist.phone,
    position: waitlist.position,
    interestResponse: data.interestResponse,
    expectations: payload.expectations,
    declineReason: payload.declineReason,
    declineReasonOther: payload.declineReasonOther,
    ideasComment: payload.ideasComment,
    waitlist,
    logPrefix: "[interest]",
  });

  if (respondentRef) {
    if ("skipped" in mail && mail.skipped) {
      await respondentRef.set(
        {
          interestAckEmailStatus: "skipped",
          interestAckEmailSentAt: now,
          interestAckEmailError: null,
        },
        { merge: true },
      );
    } else if (mail.ok) {
      await respondentRef.set(
        {
          interestAckEmailStatus: "sent",
          interestAckEmailSentAt: now,
          interestAckEmailError: null,
        },
        { merge: true },
      );
    } else {
      await respondentRef.set(
        {
          interestAckEmailStatus: "failed",
          interestAckEmailSentAt: now,
          interestAckEmailError: mail.error,
        },
        { merge: true },
      );
      console.error("[interest] ack email failed", { email, error: mail.error });
    }
  }

  return NextResponse.json({
    ok: true,
    id,
    profilePending: false,
    interestResponse: data.interestResponse,
    emailAck:
      "skipped" in mail && mail.skipped
        ? "skipped"
        : mail.ok
          ? "sent"
          : "failed",
    prospectList: listSync.list ?? null,
  });
}
