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

export function setPendingInvitees(invitees: PendingInvitee[]): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(invitees));
}

export function consumePendingInvitees(): PendingInvitee[] {
  if (typeof sessionStorage === "undefined") return [];
  const raw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingInvitee =>
        !!item && typeof item === "object" && typeof (item as PendingInvitee).email === "string",
    );
  } catch {
    return [];
  }
}
