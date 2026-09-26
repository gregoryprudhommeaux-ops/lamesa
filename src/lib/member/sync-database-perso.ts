import {
  DatabasePersoError,
  isDatabasePersoConfigured,
  upsertContact,
  type UpsertContactPayload,
} from "@/lib/database-perso";
import type { WaitlistRegistration } from "@/lib/types/events";

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
  | "locale"
  | "source"
  | "tags"
  | "referredByCode"
>;

export type DatabasePersoSyncOutcome = {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
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
  const phone = member.phone?.trim() ?? "";
  return {
    fullName: member.fullName?.trim() || "Inconnu",
    linkedinUrl: member.linkedinUrl?.trim() || undefined,
    emails: email ? [email] : [],
    phones: phone ? [phone] : [],
    company: member.company?.trim() || undefined,
    sector: member.sector?.trim() || undefined,
    position: member.position?.trim() || undefined,
    extraActivities: member.extraActivities?.length ? member.extraActivities : undefined,
    city: member.city?.trim() || undefined,
    tags: member.tags?.length ? member.tags : ["la-mesa", "waitlist"],
    source: member.source?.trim() || "la-mesa-registration",
    locale: member.locale?.trim() || "es",
    notes: buildNotes(member) || undefined,
    /** Playlist sync: INSCRITS on, CONTACTER off */
    laMesaRegistered: true,
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
      (typeof error.status === "number" && error.status >= 500))
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Soft sync: never throws. Registration/profile must succeed even if Database Perso is down.
 * Retries once on timeout / upstream 5xx (common transient Perso outages).
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

  try {
    return await attempt();
  } catch (error) {
    if (isRetryable(error)) {
      console.warn(`${logPrefix} upsert failed (retrying once):`, errorMessage(error));
      try {
        await sleep(400);
        return await attempt();
      } catch (retryError) {
        console.error(`${logPrefix} upsert failed after retry:`, retryError);
        return { ok: false, error: errorMessage(retryError) };
      }
    }
    console.error(`${logPrefix} upsert failed:`, error);
    return { ok: false, error: errorMessage(error) };
  }
}
