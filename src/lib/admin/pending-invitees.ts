import type { EventFormat } from "@/lib/constants/event-formats";
import { isEventFormat } from "@/lib/constants/event-formats";

const STORAGE_KEY = "la-mesa:pending-invitees";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PendingInvitee = {
  email: string;
  fullName?: string;
  companyName?: string;
  contactId?: string;
  source: "database_perso" | "waitlist" | "external";
  inviteAs?: "invited" | "waitlist";
};

/** Shape shared by table-idea seats and table-draft member snapshots. */
export type TableIdeaMember = {
  id: string;
  fullName: string;
  email: string;
  company: string;
  sector: string;
  position: string;
  city: string;
};

export type TableMemberInviteEmail = {
  email: string;
  fullName?: string;
  companyName?: string;
  contactId?: string;
};

/** Optional event fields seeded when creating an event from Table Builder / sujets. */
export type PendingEventSeed = {
  invitees: PendingInvitee[];
  format?: EventFormat;
  city?: string;
  title?: string;
  /** Prefill event subtitle (e.g. subject summary). */
  subtitle?: string;
  /** Suggested YYYY-MM-DD for the new dinner form. */
  date?: string;
};

/** Converts primary table members into waitlist invitees; never call with alternates. */
export function tableMembersToPendingInvitees(members: TableIdeaMember[]): PendingInvitee[] {
  return tableMembersToInviteEmails(members).map((inv) => ({
    ...inv,
    source: "waitlist" as const,
    inviteAs: "invited" as const,
  }));
}

/** Valid invite payloads for POST /api/admin/events/[id]/invitees; skips invalid emails. */
export function tableMembersToInviteEmails(members: TableIdeaMember[]): TableMemberInviteEmail[] {
  const result: TableMemberInviteEmail[] = [];
  for (const member of members) {
    const email = member.email.trim();
    if (!EMAIL_PATTERN.test(email)) continue;
    result.push({
      email,
      fullName: member.fullName,
      companyName: member.company,
      contactId: member.id,
    });
  }
  return result;
}

export function setPendingInvitees(
  invitees: PendingInvitee[],
  seed?: Omit<PendingEventSeed, "invitees">,
): void {
  if (typeof sessionStorage === "undefined") return;
  const payload: PendingEventSeed = {
    invitees,
    ...(seed?.format ? { format: seed.format } : {}),
    ...(seed?.city?.trim() ? { city: seed.city.trim() } : {}),
    ...(seed?.title?.trim() ? { title: seed.title.trim() } : {}),
    ...(seed?.subtitle?.trim() ? { subtitle: seed.subtitle.trim() } : {}),
    ...(seed?.date && /^\d{4}-\d{2}-\d{2}$/.test(seed.date.trim())
      ? { date: seed.date.trim() }
      : {}),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/** Seed Nouveau dîner without invitees (e.g. Composer depuis une idée /themes). */
export function setPendingEventSeed(seed: Omit<PendingEventSeed, "invitees">): void {
  setPendingInvitees([], seed);
}

function isPendingInvitee(item: unknown): item is PendingInvitee {
  return (
    !!item &&
    typeof item === "object" &&
    typeof (item as PendingInvitee).email === "string"
  );
}

/** @deprecated Prefer consumePendingEventSeed — kept for call sites that only need invitees. */
export function consumePendingInvitees(): PendingInvitee[] {
  return consumePendingEventSeed().invitees;
}

export function consumePendingEventSeed(): PendingEventSeed {
  if (typeof sessionStorage === "undefined") return { invitees: [] };
  const raw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!raw) return { invitees: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    // Legacy: bare invitee array
    if (Array.isArray(parsed)) {
      return { invitees: parsed.filter(isPendingInvitee) };
    }
    if (!parsed || typeof parsed !== "object") return { invitees: [] };
    const record = parsed as Record<string, unknown>;
    const invitees = Array.isArray(record.invitees)
      ? record.invitees.filter(isPendingInvitee)
      : [];
    const dateRaw = typeof record.date === "string" ? record.date.trim() : "";
    return {
      invitees,
      format: isEventFormat(record.format) ? record.format : undefined,
      city: typeof record.city === "string" ? record.city : undefined,
      title: typeof record.title === "string" ? record.title : undefined,
      subtitle: typeof record.subtitle === "string" ? record.subtitle : undefined,
      date: /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : undefined,
    };
  } catch {
    return { invitees: [] };
  }
}
