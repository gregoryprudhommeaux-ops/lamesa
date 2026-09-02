import { z } from "zod";
import type { EventInterestDeclineReason } from "@/lib/types/events";

export const INTEREST_DECLINE_REASONS = [
  "too_expensive",
  "not_available",
  "not_interested_format",
  "not_interested_theme",
  "other",
] as const satisfies readonly EventInterestDeclineReason[];

/** Split waitlist `fullName` into first / last for respondent rows. */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "—", lastName: "—" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "—" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export const eventInterestSchema = z
  .object({
    interestResponse: z.enum(["yes", "no", "other"]),
    declineReason: z.enum(INTEREST_DECLINE_REASONS).optional().nullable(),
    declineReasonOther: z.string().trim().max(500).optional().nullable(),
    expectations: z.string().trim().max(2000).optional().nullable(),
    ideasComment: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.interestResponse === "no") {
      if (!data.declineReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "decline_reason_required",
          path: ["declineReason"],
        });
      }
      if (data.declineReason === "other" && !data.declineReasonOther?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "decline_reason_other_required",
          path: ["declineReasonOther"],
        });
      }
    }
    if (data.interestResponse === "other" && !data.declineReasonOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "other_text_required",
        path: ["declineReasonOther"],
      });
    }
    if (data.interestResponse === "yes" && !(data.expectations?.trim().length ?? 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expectations_required",
        path: ["expectations"],
      });
    }
  });

export type EventInterestInput = z.infer<typeof eventInterestSchema>;

export function isInterestDeadlinePassed(deadlineAt: string | null | undefined, now = new Date()): boolean {
  if (!deadlineAt?.trim()) return false;
  const t = Date.parse(deadlineAt);
  if (Number.isNaN(t)) return false;
  return now.getTime() > t;
}
