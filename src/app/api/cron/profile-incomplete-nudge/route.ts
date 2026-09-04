import { NextResponse } from "next/server";
import { sendProfileIncompleteEmail } from "@/lib/email/send-profile-incomplete";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isProfileIncomplete } from "@/lib/member/profile-completion";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type { WaitlistRegistration } from "@/lib/types/events";

/**
 * Monthly profile-incomplete nudge (1st of month).
 * Sends ES template `profile_incomplete` to active members under 100% completion,
 * at most once per calendar month (America/Mexico_City).
 */
function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV === "development";
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const q = new URL(request.url).searchParams.get("secret") ?? "";
  return bearer === secret || q === secret;
}

async function runMonthlyProfileNudges() {
  if (!isFirebaseAdminConfigured()) {
    return { ok: false as const, error: "not_configured" };
  }

  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.waitlist).limit(500).get();
  const members = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<WaitlistRegistration, "id">),
  }));

  let checked = 0;
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const member of members) {
    checked += 1;
    if (isSoftDeleted(member)) {
      skipped += 1;
      continue;
    }
    if (!member.email?.trim()) {
      skipped += 1;
      continue;
    }
    if (!isProfileIncomplete(member)) {
      skipped += 1;
      continue;
    }

    const result = await sendProfileIncompleteEmail({ member });
    if (!result.ok) {
      errors.push(`${member.email}:${result.error}`);
      continue;
    }
    if (result.skipped) {
      skipped += 1;
      continue;
    }
    sent += 1;
  }

  return {
    ok: true as const,
    checked,
    sent,
    skipped,
    errors: errors.slice(0, 30),
  };
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await runMonthlyProfileNudges();
  if (!result.ok) {
    return NextResponse.json(result, { status: 503 });
  }
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
