import {
  DatabasePersoError,
  findContactByEmail,
  isDatabasePersoConfigured,
  upsertContact,
  type UpsertContactPayload,
} from "@/lib/database-perso";
import type { DatabasePersoContact, WaitlistRegistration } from "@/lib/types/events";
import {
  sanitizeLinkedInForPerso,
  sanitizePhoneForPerso,
  sanitizeStringList,
  truncatePersoText,
} from "./perso-field-sanitize";

export type WaitlistSyncInput = Pick<
  WaitlistRegistration,
  | "fullName"
  | "email"
  | "phone"
  | "company"
  | "sector"
  | "position"
  | "city"
  | "linkedinUrl"
  | "extraActivities"
  | "invitationMotivation"
  | "canBring"
  | "isSeeking"
  | "dinnerThemesInterest"
  | "dinnerSubjectInterests"
  | "locale"
  | "source"
  | "tags"
  | "referredByCode"
  | "updatedAt"
>;

export type DatabasePersoSyncOutcome = {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
};

export type PersoEnrichmentPatch = Partial<
  Pick<
    WaitlistRegistration,
    | "fullName"
    | "linkedinUrl"
    | "company"
    | "sector"
    | "position"
    | "city"
    | "phone"
    | "extraActivities"
    | "opsNotes"
  >
> & {
  databasePersoContactId?: string;
};

function buildNotes(member: WaitlistSyncInput): string {
  const lines = [
    member.linkedinUrl?.trim() ? `LinkedIn: ${member.linkedinUrl.trim()}` : null,
    member.sector?.trim() ? `Secteur: ${member.sector.trim()}` : null,
    member.position?.trim() ? `Poste: ${member.position.trim()}` : null,
    member.extraActivities?.length
      ? `Activités: ${member.extraActivities.join(", ")}`
      : null,
    member.city?.trim() ? `Ville: ${member.city.trim()}` : null,
    member.invitationMotivation?.trim()
      ? `Motivation: ${member.invitationMotivation.trim()}`
      : null,
    member.dinnerThemesInterest?.trim()
      ? `Thématiques dîners: ${member.dinnerThemesInterest.trim()}`
      : null,
    member.dinnerSubjectInterests?.length
      ? `Sujets catalogue: ${member.dinnerSubjectInterests
          .map((row) => `${row.title} (${row.validation})`)
          .join("; ")}`
      : null,
    member.canBring?.trim() ? `Puede aportar: ${member.canBring.trim()}` : null,
    member.isSeeking?.trim() ? `Busca: ${member.isSeeking.trim()}` : null,
    member.referredByCode?.trim() ? `Parrainé via: ${member.referredByCode.trim()}` : null,
    member.source?.includes("express") || member.source?.includes("light")
      ? "Inscription express (/light)"
      : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function toDatabasePersoUpsertPayload(member: WaitlistSyncInput): UpsertContactPayload {
  const email = member.email?.trim() ?? "";
  const phone = sanitizePhoneForPerso(member.phone);
  const linkedinUrl = sanitizeLinkedInForPerso(member.linkedinUrl) || undefined;
  return {
    fullName: truncatePersoText(member.fullName, 120) || "Inconnu",
    linkedinUrl,
    emails: email ? [email] : [],
    phones: phone ? [phone] : [],
    company: truncatePersoText(member.company, 120),
    sector: truncatePersoText(member.sector, 80),
    position: truncatePersoText(member.position, 80),
    extraActivities: sanitizeStringList(member.extraActivities, 12, 200),
    city: truncatePersoText(member.city, 80),
    tags: member.tags?.length ? member.tags.slice(0, 20) : ["la-mesa", "waitlist"],
    source: member.source?.trim() || "la-mesa-registration",
    locale: member.locale?.trim() || "es",
    notes: truncatePersoText(buildNotes(member), 3500),
    laMesaRegistered: true,
    // Newest LA MESA profile write should win on Perso when both sides have values.
    mergePolicy: "prefer_incoming",
    notesMode: "append",
    sourceUpdatedAt: member.updatedAt?.trim() || new Date().toISOString(),
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof DatabasePersoError) {
    return `${error.code}${error.status ? `:${error.status}` : ""} ${error.message}`.slice(0, 500);
  }
  if (error instanceof Error) return error.message.slice(0, 500);
  return String(error).slice(0, 500);
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof DatabasePersoError &&
    (error.code === "timeout" ||
      error.code === "upstream" ||
      (typeof error.status === "number" && (error.status >= 500 || error.status === 429)))
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isBlank(value: string | undefined | null): boolean {
  return !value || !value.trim();
}

function stampMs(value: string | undefined | null): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Build a waitlist patch from Perso contact data.
 * - Empty LA MESA fields are always filled from Perso.
 * - When Perso is newer than the LA MESA profile, Perso non-empty values win.
 */
export function buildEnrichmentPatchFromPerso(
  member: Pick<
    WaitlistRegistration,
    | "fullName"
    | "linkedinUrl"
    | "company"
    | "sector"
    | "position"
    | "city"
    | "phone"
    | "extraActivities"
    | "opsNotes"
    | "updatedAt"
    | "databasePersoContactId"
  >,
  contact: DatabasePersoContact,
): PersoEnrichmentPatch {
  const persoNewer = stampMs(contact.updatedAt) > stampMs(member.updatedAt);
  const patch: PersoEnrichmentPatch = {
    databasePersoContactId: contact.id,
  };

  const take = (
    key: keyof PersoEnrichmentPatch,
    current: string | undefined,
    incoming: string | null | undefined,
  ) => {
    const next = incoming?.trim() ?? "";
    if (!next) return;
    if (isBlank(current) || (persoNewer && next !== (current ?? "").trim())) {
      (patch as Record<string, string>)[key] = next;
    }
  };

  take("fullName", member.fullName, contact.fullName);
  take("linkedinUrl", member.linkedinUrl, contact.linkedinUrl);
  take("company", member.company, contact.company);
  take("sector", member.sector, contact.sector);
  take("position", member.position, contact.position);
  take("city", member.city, contact.city);

  const persoPhone = sanitizePhoneForPerso(contact.phones[0] ?? "");
  if (persoPhone && (isBlank(member.phone) || persoNewer)) {
    patch.phone = persoPhone;
  }

  if (
    contact.extraActivities?.length &&
    (!member.extraActivities?.length || persoNewer)
  ) {
    patch.extraActivities = contact.extraActivities.slice(0, 12);
  }

  const persoNotes = contact.notes?.trim();
  if (persoNotes) {
    const marker = "[Perso]";
    const existingOps = member.opsNotes?.trim() ?? "";
    if (!existingOps.includes(marker)) {
      const block = `${marker}\n${persoNotes}`.slice(0, 3500);
      patch.opsNotes = existingOps ? `${existingOps}\n\n${block}`.slice(0, 4000) : block;
    }
  }

  // Drop id-only patch noise if nothing else changed.
  const keys = Object.keys(patch).filter((key) => key !== "databasePersoContactId");
  if (keys.length === 0 && member.databasePersoContactId === contact.id) {
    return {};
  }
  return patch;
}

export async function enrichWaitlistMemberFromDatabasePerso(
  member: WaitlistRegistration,
  logPrefix = "[database-perso]",
): Promise<{ ok: boolean; patch: PersoEnrichmentPatch; skipped?: boolean; error?: string }> {
  if (!isDatabasePersoConfigured()) {
    return { ok: false, skipped: true, patch: {}, error: "not_configured" };
  }
  const email = member.email?.trim() ?? "";
  if (!email) {
    return { ok: false, skipped: true, patch: {}, error: "missing_email" };
  }

  try {
    const contact = await findContactByEmail(email);
    if (!contact) {
      return { ok: true, patch: {}, skipped: true, error: "not_found" };
    }
    const patch = buildEnrichmentPatchFromPerso(member, contact);
    return { ok: true, patch };
  } catch (error) {
    console.warn(`${logPrefix} enrich failed:`, errorMessage(error));
    return { ok: false, patch: {}, error: errorMessage(error) };
  }
}

/**
 * Soft sync: never throws. Registration/profile must succeed even if Database Perso is down.
 * Retries up to 3 times on timeout / upstream 5xx / 429.
 */
export async function syncWaitlistMemberToDatabasePerso(
  member: WaitlistSyncInput,
  logPrefix = "[database-perso]",
): Promise<DatabasePersoSyncOutcome> {
  if (!isDatabasePersoConfigured()) {
    return { ok: false, skipped: true, error: "not_configured" };
  }

  const payload = toDatabasePersoUpsertPayload(member);
  if (payload.emails.length === 0 && payload.phones.length === 0) {
    console.warn(`${logPrefix} skip upsert — missing email and phone`);
    return { ok: false, skipped: true, error: "missing_email_and_phone" };
  }

  async function attempt(): Promise<DatabasePersoSyncOutcome> {
    const result = await upsertContact(payload);
    if (!result.ok) {
      console.warn(`${logPrefix} upsert returned not ok`, result);
      return {
        ok: false,
        error: result.lists?.error
          ? `upsert_not_ok:${result.lists.error}`
          : "upsert_not_ok",
      };
    }
    if (!result.id?.trim()) {
      console.warn(`${logPrefix} upsert ok but missing id`, result);
      return { ok: false, error: "missing_id" };
    }
    return { ok: true, id: result.id };
  }

  const maxAttempts = 3;
  let lastError: unknown;
  for (let attemptIndex = 1; attemptIndex <= maxAttempts; attemptIndex += 1) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attemptIndex === maxAttempts) break;
      const delayMs = 350 * attemptIndex;
      console.warn(
        `${logPrefix} upsert failed (retry ${attemptIndex}/${maxAttempts - 1} in ${delayMs}ms):`,
        errorMessage(error),
      );
      await sleep(delayMs);
    }
  }

  console.error(`${logPrefix} upsert failed after retries:`, lastError);
  return { ok: false, error: errorMessage(lastError) };
}

/**
 * Pull Perso enrichment into the member snapshot, then push LA MESA → Perso.
 * Caller persists `enrich.patch` + push outcome on the waitlist doc.
 */
export async function syncWaitlistMemberBidirectional(
  member: WaitlistRegistration,
  logPrefix = "[database-perso]",
): Promise<{
  enrich: Awaited<ReturnType<typeof enrichWaitlistMemberFromDatabasePerso>>;
  push: DatabasePersoSyncOutcome;
  merged: WaitlistRegistration;
}> {
  const enrich = await enrichWaitlistMemberFromDatabasePerso(member, logPrefix);
  const merged: WaitlistRegistration = {
    ...member,
    ...enrich.patch,
    updatedAt: member.updatedAt ?? new Date().toISOString(),
  };
  const push = await syncWaitlistMemberToDatabasePerso(merged, logPrefix);
  return { enrich, push, merged };
}
