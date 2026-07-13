const STORAGE_KEY = "la-mesa:pending-invitees";

export type PendingInvitee = {
  email: string;
  fullName?: string;
  companyName?: string;
  contactId?: string;
  source: "database_perso" | "waitlist" | "external";
  inviteAs?: "invited" | "waitlist";
};

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
