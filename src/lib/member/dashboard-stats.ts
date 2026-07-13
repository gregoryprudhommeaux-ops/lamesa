export type InvitationLike = {
  status: string;
  event: { startsAt: string };
};

export type DashboardStats = {
  invitationsReceived: number;
  pastParticipations: number;
  upcomingInvitations: number;
  friendsReferred: number;
};

export function computeDashboardStats(input: {
  invitations: InvitationLike[];
  friendsReferred: number;
  nowMs?: number;
}): DashboardStats {
  const now = input.nowMs ?? Date.now();
  const invitationsReceived = input.invitations.length;
  let upcomingInvitations = 0;
  let pastParticipations = 0;

  for (const inv of input.invitations) {
    const starts = new Date(inv.event.startsAt).getTime();
    if (Number.isNaN(starts)) continue;
    if (starts >= now) {
      upcomingInvitations += 1;
    } else if (inv.status === "present" || inv.status === "invited") {
      pastParticipations += 1;
    }
  }

  return {
    invitationsReceived,
    pastParticipations,
    upcomingInvitations,
    friendsReferred: input.friendsReferred,
  };
}
