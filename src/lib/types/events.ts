export type EventParticipationStatus = "invited" | "present" | "declined" | "waitlist";
export type EventStatusSource = "admin" | "guest";
export type EventRespondentAttendance = "yes" | "no" | "maybe";

export interface AdminEvent {
  id: string;
  slug: string;
  title: string;
  organizerName?: string;
  shareEnabled?: boolean;
  eventLanguage?: "fr" | "es" | "en";
  introText?: string;
  /** Restaurant / venue name */
  venueName?: string;
  address?: string;
  registrationFormUrl?: string;
  flyerUrl?: string;
  startsAt: string;
  endsAt?: string;
  dressCode?:
    | "casual"
    | "smart_casual"
    | "business"
    | "formal"
    | "traditional"
    | "none_specified";
  mapsUrl?: string;
  parking?: "secure_nearby" | "valet" | "on_site" | "unknown";
  capacity?: number;
  status?: "draft" | "published" | "closed";
  createdAt?: string;
  updatedAt?: string;
  createdByUid?: string;
}

export interface AdminEventParticipation {
  id: string;
  eventId: string;
  contactId?: string;
  uid?: string;
  email: string;
  fullName?: string;
  companyName?: string;
  status: EventParticipationStatus;
  statusSource: EventStatusSource;
  declineReason?: string;
  adminNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EventRespondent {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  jobTitle: string;
  companyName: string;
  comments: string;
  attendance: EventRespondentAttendance;
  createdAt?: string;
}

export interface WaitlistRegistration {
  id: string;
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
  locale: string;
  source: string;
  tags: string[];
  createdAt: string;
  uid?: string;
  linkedAt?: string;
  updatedAt?: string;
  /** Soft-delete — present when member deactivated their profile */
  deletedAt?: string;
  /** Lazy-generated permanent referral code (e.g. GREG-7K) */
  referralCode?: string;
  /** Code used at registration (filleul) */
  referredByCode?: string;
  /** Waitlist doc id of sponsor */
  referredById?: string;
  /** When referral acceptance was recorded (registration with ref) */
  referralAcceptedAt?: string;
}

export interface DatabasePersoContact {
  id: string;
  fullName: string;
  company: string | null;
  emails: string[];
  phones: string[];
  tags: string[];
}
