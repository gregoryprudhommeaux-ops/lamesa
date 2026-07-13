import { NextResponse } from "next/server";

/** Password cookie admin is retired — use Firebase Google OAuth. */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "password_admin_disabled", message: "Use Google sign-in at /admin/login" },
    { status: 410 },
  );
}
