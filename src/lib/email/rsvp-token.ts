import { createHmac, timingSafeEqual } from "node:crypto";

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

function secret(): string {
  const explicit = process.env.RSVP_TOKEN_SECRET?.trim();
  if (explicit) return explicit;

  // Production must never fall back to a predictable HMAC key.
  if (isProductionRuntime()) {
    throw new Error("RSVP_TOKEN_SECRET is required in production");
  }

  return (
    process.env.FIREBASE_PRIVATE_KEY?.trim()?.slice(0, 64) ||
    "la-mesa-dev-rsvp-secret"
  );
}

export type RsvpTokenPayload = {
  participationId: string;
  eventId: string;
  email: string;
  exp: number;
  purpose?: "rsvp" | "survey";
};

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

export function signRsvpToken(
  payload: Omit<RsvpTokenPayload, "exp"> & { exp?: number; purpose?: "rsvp" | "survey" },
): string {
  const full: RsvpTokenPayload = {
    ...payload,
    purpose: payload.purpose ?? "rsvp",
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 180,
  };
  const body = b64url(JSON.stringify(full));
  const sig = createHmac("sha256", secret()).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

export function verifyRsvpToken(token: string): RsvpTokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let expected: Buffer;
  try {
    expected = createHmac("sha256", secret()).update(body).digest();
  } catch {
    return null;
  }
  const got = fromB64url(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as RsvpTokenPayload;
    if (!payload.participationId || !payload.eventId || !payload.email) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    // Survey tokens must not open RSVP endpoints
    if (payload.purpose === "survey") return null;
    return payload;
  } catch {
    return null;
  }
}

export function signSurveyToken(
  payload: Omit<RsvpTokenPayload, "exp" | "purpose"> & { exp?: number },
): string {
  return signRsvpToken({ ...payload, purpose: "survey" });
}

export function verifySurveyToken(token: string): RsvpTokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let expected: Buffer;
  try {
    expected = createHmac("sha256", secret()).update(body).digest();
  } catch {
    return null;
  }
  const got = fromB64url(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as RsvpTokenPayload;
    if (!payload.participationId || !payload.eventId || !payload.email) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    if (payload.purpose !== "survey") return null;
    return payload;
  } catch {
    return null;
  }
}
