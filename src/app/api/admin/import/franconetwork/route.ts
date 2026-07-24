import { NextResponse } from "next/server";
import {
  upsertFranconetworkWaitlistMember,
  type FranconetworkProfileInput,
} from "@/lib/member/franconetwork-import";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function authorize(request: Request): boolean {
  const expected = process.env.FRANCONETWORK_IMPORT_SECRET?.trim();
  if (!expected) return false;
  const header =
    request.headers.get("x-franconetwork-import-secret")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  return Boolean(header) && timingSafeEqual(header, expected);
}

/**
 * FrancoNetwork → LA MESA waitlist upsert.
 * Auth: header `x-franconetwork-import-secret` (or Bearer) matching FRANCONETWORK_IMPORT_SECRET.
 * New creates/revives send `fn_announcement` (ES) when the template is enabled.
 */
export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const input: FranconetworkProfileInput = {
    fullName: typeof raw.fullName === "string" ? raw.fullName : null,
    email: typeof raw.email === "string" ? raw.email : null,
    whatsapp: typeof raw.whatsapp === "string" ? raw.whatsapp : null,
    companyName: typeof raw.companyName === "string" ? raw.companyName : null,
    activityCategory: typeof raw.activityCategory === "string" ? raw.activityCategory : null,
    positionCategory: typeof raw.positionCategory === "string" ? raw.positionCategory : null,
    city: typeof raw.city === "string" ? raw.city : null,
    linkedin: typeof raw.linkedin === "string" ? raw.linkedin : null,
    networkGoal: typeof raw.networkGoal === "string" ? raw.networkGoal : null,
    memberBio: typeof raw.memberBio === "string" ? raw.memberBio : null,
    helpNewcomers: typeof raw.helpNewcomers === "string" ? raw.helpNewcomers : null,
    bio: typeof raw.bio === "string" ? raw.bio : null,
    communicationLanguage:
      typeof raw.communicationLanguage === "string" ? raw.communicationLanguage : null,
    isValidated: typeof raw.isValidated === "boolean" ? raw.isValidated : null,
  };

  const result = await upsertFranconetworkWaitlistMember(input);

  if (result.status === "error") {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  if (result.status === "skipped") {
    return NextResponse.json({ ok: true, status: result.status, reason: result.reason });
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    id: result.id,
    profileComplete: result.profileComplete,
  });
}
