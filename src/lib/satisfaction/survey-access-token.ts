import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeSurveyToken } from "@/lib/email/normalize-survey-token";
import { verifySurveyTokenResult } from "@/lib/email/rsvp-token";
import { COLLECTIONS, getAdminFirestore } from "@/lib/firebase/admin";
import type { AdminEventParticipation } from "@/lib/types/events";

/** Opaque URL token length (bytes → base64url ≈ 43 chars). Short = email-client safe. */
const ACCESS_TOKEN_BYTES = 32;

export type SurveyParticipation = AdminEventParticipation & { id: string };

export function createSurveyAccessToken(): string {
  return randomBytes(ACCESS_TOKEN_BYTES)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** True for durable opaque tokens (not legacy HMAC `body.sig`). */
export function isOpaqueSurveyAccessToken(token: string): boolean {
  if (!token || token.includes(".")) return false;
  return /^[A-Za-z0-9_-]{20,128}$/.test(token);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Persist a fresh opaque access token on the participation (rotates previous).
 * Call before sending the survey email so the link stays valid across secret rotations.
 */
export async function issueSurveyAccessToken(
  participationId: string,
): Promise<string> {
  const token = createSurveyAccessToken();
  const now = new Date().toISOString();
  await getAdminFirestore()
    .collection(COLLECTIONS.participations)
    .doc(participationId)
    .set(
      {
        satisfactionSurveyAccessToken: token,
        satisfactionSurveyAccessTokenHash: hashToken(token),
        updatedAt: now,
      },
      { merge: true },
    );
  return token;
}

export type ResolveSurveyAccessResult =
  | { ok: true; participation: SurveyParticipation; via: "opaque" | "hmac" }
  | { ok: false; error: "invalid_token" | "expired_token" | "wrong_token" | "not_found" };

/**
 * Resolve a survey URL token to a participation.
 * Prefers durable opaque tokens stored on the participation; falls back to legacy HMAC.
 */
export async function resolveSurveyAccess(
  rawToken: string,
): Promise<ResolveSurveyAccessResult> {
  const token = normalizeSurveyToken(rawToken);
  if (token.length < 10) return { ok: false, error: "invalid_token" };

  const db = getAdminFirestore();

  if (isOpaqueSurveyAccessToken(token)) {
    const snap = await db
      .collection(COLLECTIONS.participations)
      .where("satisfactionSurveyAccessToken", "==", token)
      .limit(1)
      .get();
    if (!snap.empty) {
      const doc = snap.docs[0]!;
      return {
        ok: true,
        via: "opaque",
        participation: {
          id: doc.id,
          ...(doc.data() as Omit<AdminEventParticipation, "id">),
        },
      };
    }
    // Hash fallback if plaintext field was stripped / migrated.
    const hash = hashToken(token);
    const byHash = await db
      .collection(COLLECTIONS.participations)
      .where("satisfactionSurveyAccessTokenHash", "==", hash)
      .limit(1)
      .get();
    if (!byHash.empty) {
      const doc = byHash.docs[0]!;
      const data = doc.data() as Omit<AdminEventParticipation, "id"> & {
        satisfactionSurveyAccessTokenHash?: string;
      };
      if (
        data.satisfactionSurveyAccessTokenHash &&
        safeEqualHex(data.satisfactionSurveyAccessTokenHash, hash)
      ) {
        return {
          ok: true,
          via: "opaque",
          participation: { id: doc.id, ...data },
        };
      }
    }
  }

  const hmac = verifySurveyTokenResult(token);
  if (!hmac.ok) {
    const error =
      hmac.reason === "expired"
        ? "expired_token"
        : hmac.reason === "wrong_purpose"
          ? "wrong_token"
          : "invalid_token";
    return { ok: false, error };
  }

  const snap = await db
    .collection(COLLECTIONS.participations)
    .doc(hmac.payload.participationId)
    .get();
  if (!snap.exists) return { ok: false, error: "not_found" };
  const participation = {
    id: snap.id,
    ...(snap.data() as Omit<AdminEventParticipation, "id">),
  };
  if (participation.eventId !== hmac.payload.eventId) {
    return { ok: false, error: "invalid_token" };
  }
  return { ok: true, via: "hmac", participation };
}
