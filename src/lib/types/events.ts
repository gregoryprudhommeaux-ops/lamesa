export type EventParticipationStatus =
  | "invited"
  | "attending"
  | "confirmed"
  | "not_attending"
  | "waitlist"
  /** @deprecated legacy — normalized to confirmed */
  | "present"
  /** @deprecated legacy — normalized to not_attending */
  | "declined";

export type EventStatusSource = "admin" | "guest";
export type EventRespondentAttendance = "yes" | "no" | "maybe";

export type EmailTemplateKey =
  | "calendar_invite"
  | "participation_confirmed"
  | "reminder_7d"
  | "reminder_36h"
  | "reminder_90m"
  | "satisfaction_survey"
  | "light_signup"
  | "referral_invite"
  /** Custom admin-created templates: custom_<slug> */
  | `custom_${string}`;

export type TemplateLocale = "es" | "fr" | "en";

export type EmailTemplateLocaleContent = {
  subject: string;
  body: string;
};

export interface EmailTemplateDoc {
  key: EmailTemplateKey;
  /** Resolved locale content (after getEmailTemplate) */
  subject: string;
  body: string;
  locale?: TemplateLocale;
  /** All locales when loaded from store / defaults */
  locales?: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>>;
  /** When false, automated / templated sends are skipped. Default true. */
  enabled?: boolean;
  updatedAt?: string;
  /** Human label for custom templates */
  label?: string;
  /** True when created from Admin → Templates (not a system automation key) */
  custom?: boolean;
}

export type SatisfactionSurveyAnswers = {
  venueQuality: number;
  menuQuality: number;
  guestsQuality: number;
  wouldReturn: number;
  wantInviteOther: boolean;
  invitedEmail?: string;
  submittedAt: string;
};

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
  /** Price before IVA (MXN), editable by admin */
  priceMxn?: number | null;
  /** Menu + what’s included in the price */
  menuIncluded?: string;
  status?: "draft" | "published" | "closed";
  createdAt?: string;
  updatedAt?: string;
  createdByUid?: string;
  /** Last edited invite blast template (admin) */
  inviteEmailSubject?: string;
  inviteEmailBody?: string;
  inviteEmailSentAt?: string;
  /** Per-event overrides of global email templates (per locale) */
  emailTemplateOverrides?: Partial<
    Record<
      EmailTemplateKey,
      | EmailTemplateLocaleContent
      | { locales?: Partial<Record<TemplateLocale, EmailTemplateLocaleContent>> }
    >
  >;
}

export interface AdminEventParticipation {
  id: string;
  eventId: string;
  contactId?: string;
  uid?: string;
  email: string;
  fullName?: string;
  companyName?: string;
  /** Enriched from waitlist by email (admin list only) */
  phone?: string | null;
  status: EventParticipationStatus;
  statusSource: EventStatusSource;
  /** Organizing admin seat — excluded from guest capacity. */
  isOrganizer?: boolean;
  declineReason?: string;
  adminNote?: string;
  createdAt?: string;
  updatedAt?: string;
  calendarInviteSentAt?: string;
  confirmationEmailSentAt?: string;
  reminder7dSentAt?: string;
  reminder36hSentAt?: string;
  reminder90mSentAt?: string;
  rsvpAt?: string;
  /** Thank-you + satisfaction survey email sent (~12h after start) */
  satisfactionSurveySentAt?: string;
  satisfactionSurvey?: SatisfactionSurveyAnswers;
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
  /** False for express (/light) signups until profile is completed */
  profileComplete?: boolean;
  uid?: string;
  linkedAt?: string;
  updatedAt?: string;
  /** Soft-delete — present when member deactivated their profile */
  deletedAt?: string;
  /** Linked Database Perso contact id after upsert sync */
  databasePersoContactId?: string;
  databasePersoSyncedAt?: string;
  referralCode?: string;
  referredByCode?: string;
  referredById?: string;
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
