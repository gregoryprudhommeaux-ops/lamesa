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
import {
  bulkUpdateProspects,
  listProspects,
  upsertProspect,
} from "@/lib/prospects/store";
import { softDeleteProspects } from "@/lib/prospects/lists-store";
import { syncAllWaitlistToProspects } from "@/lib/member/sync-waitlist-to-prospects";
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
  lists: z.array(z.string().trim().max(60)).max(30).optional(),
  status: z.enum(PROSPECT_STATUSES).optional(),
  seen: z.boolean().optional(),
  source: z.string().trim().max(80).optional(),
});

const bulkSchema = z.object({
  action: z.literal("bulk"),
  ids: z.array(z.string().trim().min(1)).min(1).max(500),
  status: z.enum(PROSPECT_STATUSES).optional(),
  addTags: z.array(z.string().trim().max(40)).max(20).optional(),
  addLists: z.array(z.string().trim().max(60)).max(10).optional(),
  removeLists: z.array(z.string().trim().max(60)).max(10).optional(),
  seen: z.boolean().optional(),
  softDelete: z.boolean().optional(),
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
  const list = url.searchParams.get("list")?.trim() || undefined;

  try {
    const prospects = await listProspects({ status, list, limit: 3000 });
    const listNames = [
      ...new Set(prospects.flatMap((p) => p.lists ?? []).map((l) => l.trim()).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "fr"));
    return NextResponse.json({
      ok: true,
      count: prospects.length,
      prospects,
      listNames,
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

  if (action === "sync-waitlist") {
    try {
      const result = await syncAllWaitlistToProspects({
        logPrefix: "[admin/prospects sync-waitlist]",
      });
      return NextResponse.json({ action: "sync-waitlist", ...result });
    } catch (error) {
      console.error("[admin/prospects sync-waitlist]", error);
      return NextResponse.json({ ok: false, error: "sync_failed" }, { status: 502 });
    }
  }

  if (action === "bulk") {
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }
    const { ids, status, addTags, addLists, removeLists, seen, softDelete } = parsed.data;
    if (
      !softDelete &&
      !status &&
      seen === undefined &&
      !(addTags?.length) &&
      !(addLists?.length) &&
      !(removeLists?.length)
    ) {
      return NextResponse.json({ ok: false, error: "nothing_to_update" }, { status: 400 });
    }
    try {
      if (softDelete) {
        const updated = await softDeleteProspects(ids);
        return NextResponse.json({ ok: true, action: "bulk", updated });
      }
      // Ensure list registry exists when adding to lists
      if (addLists?.length) {
        const { createProspectList } = await import("@/lib/prospects/lists-store");
        for (const name of addLists) {
          await createProspectList(name);
        }
      }
      const updated = await bulkUpdateProspects({
        ids,
        status,
        addTags,
        addLists,
        removeLists,
        seen,
      });
      if (addLists?.length) {
        for (const id of ids) {
          void import("@/lib/contacts/activities-store").then(async ({ recordContactActivity }) => {
            const p = await import("@/lib/prospects/store").then((m) => m.getProspectById(id));
            if (!p) return;
            for (const listName of addLists) {
              await recordContactActivity({
                email: p.email,
                type: "list_added",
                source: "admin",
                summary: `Ajouté à la liste « ${listName} »`,
                refs: { prospectId: id, listName },
              });
            }
          });
        }
      }
      if (removeLists?.length) {
        for (const id of ids) {
          void import("@/lib/contacts/activities-store").then(async ({ recordContactActivity }) => {
            const p = await import("@/lib/prospects/store").then((m) => m.getProspectById(id));
            if (!p) return;
            for (const listName of removeLists) {
              await recordContactActivity({
                email: p.email,
                type: "list_added",
                source: "admin",
                summary: `Retiré de la liste « ${listName} »`,
                refs: { prospectId: id, listName },
                meta: { action: "removed" },
              });
            }
          });
        }
      }
      if (status) {
        for (const id of ids.slice(0, 50)) {
          void import("@/lib/contacts/activities-store").then(async ({ recordContactActivity }) => {
            const p = await import("@/lib/prospects/store").then((m) => m.getProspectById(id));
            if (!p) return;
            await recordContactActivity({
              email: p.email,
              type: "status_changed",
              source: "admin",
              summary: `Statut → ${status}`,
              refs: { prospectId: id },
              meta: { status },
            });
          });
        }
      }
      return NextResponse.json({ ok: true, action: "bulk", updated });
    } catch (error) {
      console.error("[admin/prospects bulk]", error);
      return NextResponse.json({ ok: false, error: "bulk_failed" }, { status: 502 });
    }
  }

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
    if (result.action === "created") {
      void import("@/lib/contacts/activities-store").then(({ recordContactActivity }) =>
        recordContactActivity({
          email: result.prospect.email,
          type: "added_prospect",
          source: "admin",
          summary: "Ajouté au CRM Prospects",
          refs: { prospectId: result.prospect.id },
        }),
      );
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
