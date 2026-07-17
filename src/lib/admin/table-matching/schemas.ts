import { z } from "zod";

export const tableIdeasRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    city: z.string().trim().min(2).max(80),
    mode: z.literal("spontaneous"),
    excludeMemberIds: z.array(z.string().min(1)).max(200).default([]),
  }),
  z.object({
    city: z.string().trim().min(2).max(80),
    mode: z.literal("admin_theme"),
    theme: z.string().trim().min(3).max(500),
    excludeMemberIds: z.array(z.string().min(1)).max(200).default([]),
  }),
]);

export const aiTableIdeasSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string().min(3).max(120),
        themeAngle: z.string().min(3).max(300),
        rationale: z.string().min(10).max(1500),
        commonalities: z.array(z.string().min(2).max(240)).max(8),
        complementarities: z.array(z.string().min(2).max(240)).max(8),
        warnings: z.array(z.string().min(2).max(240)).max(8),
        primaryMemberIds: z.array(z.string().min(1)).max(15),
        alternateMemberIds: z.array(z.string().min(1)).max(5),
      }),
    )
    .min(1)
    .max(4),
});

export type TableIdeasErrorCode =
  | "validation"
  | "pool_too_small"
  | "ai_not_configured"
  | "ai_invalid"
  | "fetch_failed";

export class TableIdeasError extends Error {
  code: TableIdeasErrorCode;

  constructor(code: TableIdeasErrorCode, message?: string) {
    super(message ?? code);
    this.name = "TableIdeasError";
    this.code = code;
  }
}
