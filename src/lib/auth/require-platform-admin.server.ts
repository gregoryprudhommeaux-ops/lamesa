import { NextResponse } from "next/server";
import { isPlatformAdminIdentity } from "@/lib/auth/platform-admin";
import { verifyBearerUser, type VerifiedUser } from "@/lib/auth/verify-bearer";

export type PlatformAdminContext = VerifiedUser & { email: string };

export async function requirePlatformAdmin(
  request: Request,
): Promise<PlatformAdminContext | NextResponse> {
  const user = await verifyBearerUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!isPlatformAdminIdentity({ email: user.email })) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  return { uid: user.uid, email: user.email ?? "" };
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
