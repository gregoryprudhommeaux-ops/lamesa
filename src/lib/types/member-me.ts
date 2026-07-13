import type { DashboardStats } from "@/lib/member/dashboard-stats";
import type { WaitlistRegistration } from "@/lib/types/events";

export type MemberFellow = { fullName?: string; companyName?: string; status: string };

export type MemberInvitationEntry = {
  participationId: string;
  status: string;
  event: {
    id: string;
    slug: string;
    title: string;
    startsAt: string;
    endsAt?: string;
    venueName?: string;
    address?: string;
    mapsUrl?: string;
    status?: string;
  };
  fellows: MemberFellow[];
};

export type MemberReferralInfo = {
  code: string | null;
  canBeSponsor: boolean;
};

export type MePayload = {
  ok?: boolean;
  profile: (WaitlistRegistration & { id: string }) | null;
  notOnWaitlist?: boolean;
  pastInvitations: MemberInvitationEntry[];
  upcomingInvitations: MemberInvitationEntry[];
  stats: DashboardStats;
  referral: MemberReferralInfo;
  isAdmin?: boolean;
  error?: string;
};
