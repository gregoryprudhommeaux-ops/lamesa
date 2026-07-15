import { FieldValue } from "firebase-admin/firestore";
import {
  findWaitlistByEmail,
  findWaitlistByEmailIncludingDeleted,
} from "@/lib/auth/member.server";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { syncWaitlistMemberToDatabasePerso } from "@/lib/member/sync-database-perso";
import { isSoftDeleted } from "@/lib/member/soft-delete";

/** Minimal FrancoNetwork user payload used for mapping / import. */
export type FranconetworkProfileInput = {
  fullName?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  companyName?: string | null;
  activityCategory?: string | null;
  positionCategory?: string | null;
  city?: string | null;
  linkedin?: string | null;
  networkGoal?: string | null;
  memberBio?: string | null;
  helpNewcomers?: string | null;
  /** @deprecated legacy FN field */
  bio?: string | null;
  communicationLanguage?: string | null;
  /**
   * Directory visibility on FrancoNetwork: visible when not explicitly false
   * (`isValidated !== false`, same filter as the annuaire UI).
   */
  isValidated?: boolean | null;
};

export type FranconetworkWaitlistRecord = {
  fullName: string;
  linkedinUrl: string;
  email: string;
  company: string;
  sector: string;
  position: string;
  extraActivities: string[];
  city: string;
  phone: string;
  invitationMotivation: string;
  locale: "fr" | "es" | "en";
  source: "franconetwork";
  tags: string[];
  profileComplete: boolean;
  createdAt: string;
};

export type UpsertFranconetworkResult =
  | { status: "created"; id: string; profileComplete: boolean }
  | { status: "revived"; id: string; profileComplete: boolean }
  | {
      status: "skipped";
      reason: "already_active" | "missing_email" | "missing_fullName" | "not_validated";
    }
  | { status: "error"; error: string };

const FN_TAGS = ["la-mesa", "waitlist", "guadalajara", "franconetwork"] as const;

/** Visible in FN directory (annuaire) — same rule as FrancoNetwork UI. */
export function isFranconetworkDirectoryVisible(
  input: Pick<FranconetworkProfileInput, "isValidated">,
): boolean {
  return input.isValidated !== false;
}

function trimText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function pickMotivation(input: FranconetworkProfileInput): string {
  return (
    trimText(input.networkGoal) ||
    trimText(input.memberBio) ||
    trimText(input.helpNewcomers) ||
    trimText(input.bio) ||
    ""
  );
}

function normalizeLocale(raw: string | null | undefined): "fr" | "es" | "en" {
  const v = trimText(raw).toLowerCase();
  if (v === "fr" || v === "es" || v === "en") return v;
  return "es";
}

/** profileComplete when name+email and ≥3 of the enrichment fields are present. */
export function computeFranconetworkProfileComplete(
  record: Pick<
    FranconetworkWaitlistRecord,
    "fullName" | "email" | "phone" | "company" | "sector" | "position" | "city" | "linkedinUrl" | "invitationMotivation"
  >,
): boolean {
  if (!trimText(record.fullName) || !trimText(record.email)) return false;
  const signals = [
    Boolean(trimText(record.phone)),
    Boolean(trimText(record.company)),
    Boolean(trimText(record.sector)),
    Boolean(trimText(record.position)),
    Boolean(trimText(record.city)),
    Boolean(trimText(record.linkedinUrl)),
    trimText(record.invitationMotivation).length >= 10,
  ];
  return signals.filter(Boolean).length >= 3;
}

export function mapFnProfileToWaitlist(
  input: FranconetworkProfileInput,
  nowIso = new Date().toISOString(),
): FranconetworkWaitlistRecord | null {
  const fullName = trimText(input.fullName);
  const emailRaw = trimText(input.email);
  if (!fullName || !emailRaw || !emailRaw.includes("@")) return null;

  const email = normalizeEmail(emailRaw);
  const phone = trimText(input.whatsapp);
  const company = trimText(input.companyName);
  const sector = trimText(input.activityCategory);
  const position = trimText(input.positionCategory);
  const city = trimText(input.city);
  const linkedinUrl = trimText(input.linkedin);
  const invitationMotivation = pickMotivation(input);
  const locale = normalizeLocale(input.communicationLanguage);

  const draft: FranconetworkWaitlistRecord = {
    fullName,
    linkedinUrl,
    email,
    company,
    sector,
    position,
    extraActivities: [],
    city,
    phone,
    invitationMotivation,
    locale,
    source: "franconetwork",
    tags: [...FN_TAGS],
    profileComplete: false,
    createdAt: nowIso,
  };
  draft.profileComplete = computeFranconetworkProfileComplete(draft);
  return draft;
}

function mergeEmptyOnly(
  existing: Record<string, unknown>,
  incoming: FranconetworkWaitlistRecord,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    source: "franconetwork",
    tags: [...FN_TAGS],
    profileComplete: incoming.profileComplete,
    updatedAt: incoming.createdAt,
  };

  const fields: Array<keyof FranconetworkWaitlistRecord> = [
    "fullName",
    "linkedinUrl",
    "company",
    "sector",
    "position",
    "city",
    "phone",
    "invitationMotivation",
    "locale",
  ];

  for (const key of fields) {
    const current = existing[key];
    const next = incoming[key];
    const currentEmpty =
      current === undefined ||
      current === null ||
      (typeof current === "string" && !String(current).trim()) ||
      (Array.isArray(current) && current.length === 0);
    if (currentEmpty && next !== undefined && next !== null && next !== "") {
      out[key] = next;
    }
  }

  if (!Array.isArray(existing.extraActivities)) {
    out.extraActivities = [];
  }

  return out;
}

/**
 * Silent upsert into la_mesa_waitlist. Never sends emails.
 * - Active email → skip
 * - Soft-deleted → revive + fill empty fields only
 * - Missing → create
 */
export async function upsertFranconetworkWaitlistMember(
  input: FranconetworkProfileInput,
): Promise<UpsertFranconetworkResult> {
  if (!isFranconetworkDirectoryVisible(input)) {
    return { status: "skipped", reason: "not_validated" };
  }

  const record = mapFnProfileToWaitlist(input);
  if (!record) {
    if (!trimText(input.email)) return { status: "skipped", reason: "missing_email" };
    if (!trimText(input.fullName)) return { status: "skipped", reason: "missing_fullName" };
    return { status: "skipped", reason: "missing_email" };
  }

  if (!isFirebaseAdminConfigured()) {
    return { status: "error", error: "firebase_not_configured" };
  }

  try {
    const active = await findWaitlistByEmail(record.email);
    if (active) {
      return { status: "skipped", reason: "already_active" };
    }

    const db = getAdminFirestore();
    const existing = await findWaitlistByEmailIncludingDeleted(record.email);
    const now = record.createdAt;

    if (existing && isSoftDeleted(existing)) {
      const patch = mergeEmptyOnly(existing as unknown as Record<string, unknown>, {
        ...record,
        createdAt: now,
      });
      await db.collection(COLLECTIONS.waitlist).doc(existing.id).set(
        {
          ...patch,
          email: record.email,
          deletedAt: FieldValue.delete(),
        },
        { merge: true },
      );

      // Await Perso sync (same as /api/register) — void fire-and-forget is dropped on Vercel after response.
      const sync = await syncWaitlistMemberToDatabasePerso(
        { ...record, referredByCode: undefined },
        "[franconetwork-import]",
      );
      if (sync.id) {
        await db.collection(COLLECTIONS.waitlist).doc(existing.id).set(
          {
            databasePersoContactId: sync.id,
            databasePersoSyncedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }

      return { status: "revived", id: existing.id, profileComplete: record.profileComplete };
    }

    const ref = await db.collection(COLLECTIONS.waitlist).add(record);

    const sync = await syncWaitlistMemberToDatabasePerso(
      { ...record, referredByCode: undefined },
      "[franconetwork-import]",
    );
    if (sync.id) {
      await db.collection(COLLECTIONS.waitlist).doc(ref.id).set(
        {
          databasePersoContactId: sync.id,
          databasePersoSyncedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }

    return { status: "created", id: ref.id, profileComplete: record.profileComplete };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : String(e) };
  }
}
