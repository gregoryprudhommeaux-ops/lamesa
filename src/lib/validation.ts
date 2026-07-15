import { z } from "zod";
import { isValidLinkedInUrl } from "./linkedin";

export const registrationSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  linkedinUrl: z
    .string()
    .trim()
    .refine((v) => isValidLinkedInUrl(v), { message: "invalid_linkedin" }),
  email: z.string().trim().email().max(254),
  company: z.string().trim().min(2).max(120),
  sector: z.string().trim().min(1).max(80),
  position: z.string().trim().min(1).max(80),
  extraActivities: z.preprocess(
    (val) => (typeof val === "string" ? [val] : val),
    z.array(z.string().trim().min(2).max(500)).min(1),
  ),
  city: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    }, { message: "invalid_phone" }),
  invitationMotivation: z.string().trim().min(10).max(2000),
  locale: z.enum(["fr", "en", "es"]),
  website: z.string().optional(),
  referralCode: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

/** Express signup (/light) — contact only; profile completed later in /compte */
export const expressRegistrationSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(254),
  phone: z
    .string()
    .trim()
    .refine((v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    }, { message: "invalid_phone" }),
  locale: z.enum(["fr", "en", "es"]),
  website: z.string().optional(),
  referralCode: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export type ExpressRegistrationInput = z.infer<typeof expressRegistrationSchema>;

/** Public contact — questions & partnerships */
export const contactInquirySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z
    .string()
    .trim()
    .refine((v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    }, { message: "invalid_phone" }),
  company: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  topic: z.enum(["question", "partnership"]),
  message: z.string().trim().min(20).max(4000),
  locale: z.enum(["fr", "en", "es"]),
  website: z.string().optional(),
});

export type ContactInquiryInput = z.infer<typeof contactInquirySchema>;

export const eventSchema = z.object({
  title: z.string().trim().min(3).max(200),
  organizerName: z.string().trim().max(120).optional(),
  introText: z.string().trim().max(2000).optional(),
  venueName: z.string().trim().max(200).optional(),
  address: z.string().trim().max(300).optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  priceMxn: z.number().min(0).max(1_000_000).optional().nullable(),
  menuIncluded: z.string().trim().max(4000).optional(),
  dressCode: z
    .enum(["casual", "smart_casual", "business", "formal", "traditional", "none_specified"])
    .optional(),
  parking: z.enum(["secure_nearby", "valet", "on_site", "unknown"]).optional(),
  mapsUrl: z.string().url().optional().or(z.literal("")),
  registrationFormUrl: z.string().url().optional().or(z.literal("")),
  flyerUrl: z.string().url().optional().or(z.literal("")),
  shareEnabled: z.boolean().optional(),
  status: z.enum(["draft", "published", "closed"]).optional(),
  eventLanguage: z.enum(["fr", "es", "en"]).optional(),
  inviteEmails: z
    .array(
      z.object({
        email: z.string().email(),
        fullName: z.string().optional(),
        companyName: z.string().optional(),
        contactId: z.string().optional(),
        status: z.enum(["invited", "waitlist"]).optional(),
      }),
    )
    .optional(),
});
