import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "la_mesa_admin_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getAdminSessionSecret(): string | null {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) return null;
  return hashToken(`la-mesa-admin:${password}`);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const secret = getAdminSessionSecret();
  if (!secret) return false;

  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!session) return false;

  try {
    const a = Buffer.from(session);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyAdminPassword(password: string): boolean {
  const secret = getAdminSessionSecret();
  if (!secret) return false;
  const attempt = hashToken(`la-mesa-admin:${password}`);
  try {
    const a = Buffer.from(attempt);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getAdminSessionValue(): string | null {
  return getAdminSessionSecret();
}
