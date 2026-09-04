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
export type EventRespondentAttendance = "yes" | "no" | "maybe" | "other";

/** Save-the-Date / interest response (distinct from paid-seat RSVP). */
export type EventInterestResponse = "yes" | "no" | "other";

export type EventInterestDeclineReason =
  | "too_expensive"
  | "not_available"
  | "not_interested_format"
  | "not_interested_theme"
  | "other";

export type EventResponseMode = "rsvp" | "interest";

export type EmailTemplateKey =
  | "calendar_invite"
  | "participation_confirmed"
  | "reminder_7d"
  | "reminder_36h"
  | "reminder_90m"
  | "satisfaction_survey"
  | "light_signup"
  | "referral_invite"
  /** FrancoNetwork → LA MESA announcement (ES send) */
  | "fn_announcement"
  /** Monthly nudge: profile not 100% complete */
  | "profile_incomplete"
  /** Nominative Save the Date / interest invite */
  | "save_the_date"
  /** Auto ack after member validates Save the Date interest reply */
  | "interest_ack"
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
  /** Optional city signal used for city-specific event history. */
  city?: string;
  /**
   * Gathering format — breakfast / coffee / aperitif / dinner.
   * Defaults to dinner when omitted (legacy events).
   */
  format?: "breakfast" | "coffee" | "aperitif" | "dinner";
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
  /**
   * ACCESS ticket before IVA (MXN) — amount charged to confirm the seat.
   * Typical default ~450 MXN.
   */
  priceMxn?: number | null;
  /** ACCESS includes a welcome drink */
  accessIncludesWelcomeDrink?: boolean;
  /** ACCESS includes amuse-bouches */
  accessIncludesAmuseBouche?: boolean;
  /** Negotiated menu description (guest pays on site) */
  menuIncluded?: string;
  /** Negotiated menu estimate — low end (MXN / person, on site) */
  menuPriceMinMxn?: number | null;
  /** Negotiated menu estimate — high end (MXN / person, on site) */
  menuPriceMaxMxn?: number | null;
  /**
   * Whether drinks are included in the negotiated-menu estimate.
   * null/undefined = not specified.
   */
  menuIncludesDrinks?: boolean | null;
  /**
   * Pricing model for guest payment.
   * - ticket_onsite: ticket confirms seat; meal/consumptions paid on site
   * - all_inclusive: one ticket covers access + meal (drinks optional)
   */
  pricingMode?: "ticket_onsite" | "all_inclusive";
  /**
   * Public page response mode.
   * - rsvp (default): classic confirm-presence form
   * - interest: Save the Date YES/NO/OTHER + reasons
   */
  responseMode?: EventResponseMode;
  /** Optional subtitle under the title (e.g. Save the Date editions). */
  subtitle?: string;
  /** ISO datetime — after this, interest form soft-locks (Mexico City end of day recommended). */
  interestDeadlineAt?: string | null;
  /** All-in price range for interest editions (MXN / person, ticket + menu). */
  allInPriceMinMxn?: number | null;
  allInPriceMaxMxn?: number | null;
  /** Public ordinal for masked calendar label (LA MESA 001). */
  mesaNumber?: number | null;
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
  whatsapp?: string;
  jobTitle?: string;
  companyName?: string;
  comments?: string;
  /** Legacy guest form always wrote "yes". Interest form uses interestResponse. */
  attendance: EventRespondentAttendance;
  /** Save-the-Date interest answer */
  interestResponse?: EventInterestResponse;
  declineReason?: EventInterestDeclineReason | null;
  declineReasonOther?: string | null;
  /** Expectations for this dinner (required on YES) */
  expectations?: string | null;
  /** Ideas for next events / free comment */
  ideasComment?: string | null;
  /** Self-attestation: French dirigeant / fondateur / entrepreneur */
  frenchFounderAttested?: boolean;
  /** True when email is not yet on LA MESA waitlist */
  profilePending?: boolean;
  waitlistId?: string | null;
  /** Auto email after interest form submit */
  interestAckEmailStatus?: "sent" | "failed" | "skipped";
  interestAckEmailSentAt?: string;
  interestAckEmailError?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface WaitlistRegistration {
  id: string;
  fullName: string;
  linkedinUrl: string;
  email: string;
  company: string;
  sector: string;
  /** Free-text detail required when sector === "other" (for matching). */
  sectorOther?: string;
  position: string;
  extraActivities: string[];
  city: string;
  phone: string;
  invitationMotivation: string;
  canBring?: string;
  isSeeking?: string;
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
  /** Outcome of Database Perso upsert at signup / profile sync */
  databasePersoSyncStatus?: "synced" | "failed" | "skipped";
  /** Welcome / express confirmation email to the member */
  welcomeEmailStatus?: "sent" | "failed" | "skipped";
  welcomeEmailSentAt?: string;
  welcomeEmailError?: string;
  /** FrancoNetwork announcement email (manual or auto on import) */
  fnAnnouncementEmailStatus?: "sent" | "failed" | "skipped";
  fnAnnouncementEmailSentAt?: string;
  fnAnnouncementEmailError?: string;
  /** Last month (YYYY-MM) a profile-incomplete nudge was sent */
  profileIncompleteNudgeMonth?: string;
  profileIncompleteEmailStatus?: "sent" | "failed" | "skipped";
  profileIncompleteEmailSentAt?: string;
  profileIncompleteEmailError?: string;
  referralCode?: string;
  referredByCode?: string;
  referredById?: string;
  referralAcceptedAt?: string;
  /**
   * Admin ops notes (post-dinner CRM, curation). Not synced to Database Perso.
   */
  opsNotes?: string;
  /** Admin prioritization band for cockpit queues. */
  opsPriority?: "priority" | "normal" | "review" | "low";
  /** Freeform ops tags (e.g. no-show, vip, partner-fit). */
  opsTags?: string[];
  /** Last time an admin edited ops fields. */
  opsTouchedAt?: string;
}

export interface DatabasePersoContact {
  id: string;
  fullName: string;
  company: string | null;
  emails: string[];
  phones: string[];
  tags: string[];
}

export type TableDraftStatus = "draft" | "used" | "archived";

export interface TableDraftMemberSnapshot {
  id: string;
  fullName: string;
  email: string;
  company: string;
  sector: string;
  position: string;
  city: string;
}

export interface TableDraft {
  id: string;
  title: string;
  city: string;
  /** Gathering format — defaults to dinner for legacy drafts. */
  format: "breakfast" | "coffee" | "aperitif" | "dinner";
  themeAngle: string;
  rationale: string;
  commonalities: string[];
  complementarities: string[];
  warnings: string[];
  primary: TableDraftMemberSnapshot[];
  alternates: TableDraftMemberSnapshot[];
  status: TableDraftStatus;
  linkedEventId?: string;
  /** ISO timestamp — admin confirmed human review before invites. */
  humanValidatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByUid: string;
  createdByEmail: string;
}
