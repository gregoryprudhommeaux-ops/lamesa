import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  googleSheetToCsvExportUrl,
  parseProspectImportText,
} from "@/lib/prospects/parse-import";
import { listProspects, upsertProspect } from "@/lib/prospects/store";
import { PROSPECT_STATUSES } from "@/lib/types/prospects";

const IMPORT_LIMIT = 500;
const BATCH_SEND_HINT = 50;

const createSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
  position: z.string().trim().max(200).optional(),
  sector: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  linkedin: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(4000).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  status: z.enum(PROSPECT_STATUSES).optional(),
  source: z.string().trim().max(80).optional(),
});

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const statusRaw = url.searchParams.get("status");
  const status =
    statusRaw && (PROSPECT_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as (typeof PROSPECT_STATUSES)[number])
      : undefined;

  try {
    const prospects = await listProspects({ status, limit: 3000 });
    return NextResponse.json({
      ok: true,
      count: prospects.length,
      prospects,
      batchSizeHint: BATCH_SEND_HINT,
    });
  } catch (error) {
    console.error("[admin/prospects GET]", error);
    return NextResponse.json({ ok: false, error: "list_failed" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const action =
    body && typeof body === "object" && "action" in body
      ? String((body as { action?: string }).action ?? "create")
      : "create";

  if (action === "import") {
    const text =
      body && typeof body === "object" && "text" in body
        ? String((body as { text?: string }).text ?? "")
        : "";
    const sheetUrl =
      body && typeof body === "object" && "sheetUrl" in body
        ? String((body as { sheetUrl?: string }).sheetUrl ?? "").trim()
        : "";

    let csvText = text;
    if (!csvText && sheetUrl) {
      const exportUrl = googleSheetToCsvExportUrl(sheetUrl);
      if (!exportUrl) {
        return NextResponse.json({ ok: false, error: "invalid_sheet_url" }, { status: 400 });
      }
      try {
        const res = await fetch(exportUrl, { redirect: "follow" });
        if (!res.ok) {
          return NextResponse.json(
            { ok: false, error: "sheet_fetch_failed", status: res.status },
            { status: 502 },
          );
        }
        csvText = await res.text();
        if (!csvText.trim() || csvText.includes("<!DOCTYPE html")) {
          return NextResponse.json(
            {
              ok: false,
              error: "sheet_not_public",
              detail: "Rends le Sheet public (lecteur) ou colle le CSV.",
            },
            { status: 400 },
          );
        }
      } catch (error) {
        console.error("[admin/prospects import sheet]", error);
        return NextResponse.json({ ok: false, error: "sheet_fetch_failed" }, { status: 502 });
      }
    }

    const rows = parseProspectImportText(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "no_emails_parsed" }, { status: 400 });
    }
    if (rows.length > IMPORT_LIMIT) {
      return NextResponse.json(
        { ok: false, error: "too_many", limit: IMPORT_LIMIT, count: rows.length },
        { status: 400 },
      );
    }

    let created = 0;
    let merged = 0;
    let failed = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const row of rows) {
      const result = await upsertProspect(row, { source: sheetUrl ? "google-sheet" : "csv-paste" });
      if (!result.ok) {
        failed += 1;
        errors.push({ email: row.email, error: result.error });
        continue;
      }
      if (result.action === "created") created += 1;
      else merged += 1;
    }

    return NextResponse.json({
      ok: true,
      action: "import",
      parsed: rows.length,
      created,
      merged,
      failed,
      errors: errors.slice(0, 20),
    });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  try {
    const result = await upsertProspect(parsed.data, { source: parsed.data.source ?? "manual" });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      action: result.action,
      prospect: result.prospect,
    });
  } catch (error) {
    console.error("[admin/prospects create]", error);
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 502 });
  }
}
