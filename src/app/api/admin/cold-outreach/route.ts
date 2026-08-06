import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import {
  addLaMesaToContacter,
  ensureLaMesaLists,
  isDatabasePersoConfigured,
  listLaMesaToContact,
  markLaMesaContacted,
} from "@/lib/database-perso";
import { firstEmail, sendColdTemplateEmail } from "@/lib/email/send-cold-template";
import { isCustomEmailTemplateKey } from "@/lib/email/template-defaults";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { parseContacterImportText } from "@/lib/admin/parse-contacter-import";
import { syncWaitlistMemberToDatabasePerso } from "@/lib/member/sync-database-perso";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import type { WaitlistRegistration } from "@/lib/types/events";

const BULK_IMPORT_LIMIT = 250;

async function loadWaitlistEmails(): Promise<Set<string>> {
  if (!isFirebaseAdminConfigured()) return new Set();
  const snap = await getAdminFirestore().collection(COLLECTIONS.waitlist).limit(5000).get();
  const emails = new Set<string>();
  for (const doc of snap.docs) {
    const row = { id: doc.id, ...(doc.data() as Omit<WaitlistRegistration, "id">) };
    if (isSoftDeleted(row)) continue;
    const email = row.email?.trim().toLowerCase();
    if (email?.includes("@")) emails.add(email);
  }
  return emails;
}

/** Recipients: Perso CONTACTER + A CONTACTER, minus waitlist. */
export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isDatabasePersoConfigured()) {
    return NextResponse.json({ ok: false, error: "database_perso_not_configured" }, { status: 503 });
  }

  try {
    const ensured = await ensureLaMesaLists();
    if (!ensured.ok) {
      return NextResponse.json(
        { ok: false, error: "perso_ensure_lists_failed" },
        { status: 502 },
      );
    }

    const [listed, waitlistEmails] = await Promise.all([
      listLaMesaToContact(),
      loadWaitlistEmails(),
    ]);

    if (!listed.ok) {
      return NextResponse.json({ ok: false, error: "perso_list_failed" }, { status: 502 });
    }

    const recipients = listed.contacts
      .map((c) => {
        const email = firstEmail(c.emails);
        return {
          id: c.id,
          fullName: c.fullName || email || "—",
          email,
          company: c.company,
          alreadyOnWaitlist: email ? waitlistEmails.has(email) : false,
        };
      })
      .filter((r) => r.email.includes("@"));

    const eligible = recipients.filter((r) => !r.alreadyOnWaitlist);
    const skippedWaitlist = recipients.filter((r) => r.alreadyOnWaitlist);

    return NextResponse.json({
      ok: true,
      listName: "LA MESA - CONTACTER",
      actionFilter: "A CONTACTER",
      count: eligible.length,
      recipients: eligible,
      skippedWaitlist,
    });
  } catch (error) {
    console.error("[admin/cold-outreach GET]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}

const addSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
});

const sendSchema = z.object({
  templateKey: z.string().min(1),
  locale: z.enum(["es", "fr", "en"]).default("es"),
  contactIds: z.array(z.string().min(1)).optional(),
  /** If true, only report who would be mailed */
  dryRun: z.boolean().optional(),
});

/** Manual add or send cold campaign. */
export async function POST(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isDatabasePersoConfigured()) {
    return NextResponse.json({ ok: false, error: "database_perso_not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const action =
    body && typeof body === "object" && "action" in body
      ? String((body as { action?: string }).action ?? "send")
      : "send";

  if (action === "add") {
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }
    const waitlistEmails = await loadWaitlistEmails();
    const email = parsed.data.email.trim().toLowerCase();
    if (waitlistEmails.has(email)) {
      return NextResponse.json(
        { ok: false, error: "already_on_waitlist", email },
        { status: 409 },
      );
    }
    try {
      const result = await addLaMesaToContacter({
        email,
        fullName: parsed.data.fullName,
        company: parsed.data.company,
        phone: parsed.data.phone,
      });
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error ?? "add_failed" },
          { status: 502 },
        );
      }
      return NextResponse.json({ ok: true, contact: result });
    } catch (error) {
      console.error("[admin/cold-outreach add]", error);
      return NextResponse.json({ ok: false, error: "add_failed" }, { status: 502 });
    }
  }

  if (action === "import-contacter") {
    const text =
      body && typeof body === "object" && "text" in body
        ? String((body as { text?: string }).text ?? "")
        : "";
    const rows = parseContacterImportText(text);
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "no_emails_parsed" }, { status: 400 });
    }
    if (rows.length > BULK_IMPORT_LIMIT) {
      return NextResponse.json(
        { ok: false, error: "too_many", limit: BULK_IMPORT_LIMIT, count: rows.length },
        { status: 400 },
      );
    }
    try {
      await ensureLaMesaLists();
      const waitlistEmails = await loadWaitlistEmails();
      let added = 0;
      let skippedWaitlist = 0;
      let failed = 0;
      const errors: Array<{ email: string; error: string }> = [];

      for (const row of rows) {
        if (waitlistEmails.has(row.email)) {
          skippedWaitlist += 1;
          continue;
        }
        const result = await addLaMesaToContacter(row);
        if (result.ok) {
          added += 1;
        } else {
          failed += 1;
          errors.push({ email: row.email, error: result.error ?? "add_failed" });
        }
      }

      return NextResponse.json({
        ok: true,
        action: "import-contacter",
        parsed: rows.length,
        added,
        skippedWaitlist,
        failed,
        errors: errors.slice(0, 20),
      });
    } catch (error) {
      console.error("[admin/cold-outreach import-contacter]", error);
      return NextResponse.json({ ok: false, error: "import_failed" }, { status: 502 });
    }
  }

  if (action === "backfill-inscrits") {
    try {
      await ensureLaMesaLists();
      if (!isFirebaseAdminConfigured()) {
        return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
      }
      const snap = await getAdminFirestore().collection(COLLECTIONS.waitlist).limit(3000).get();
      let synced = 0;
      let failed = 0;
      let skipped = 0;
      for (const doc of snap.docs) {
        const row = {
          id: doc.id,
          ...(doc.data() as Omit<WaitlistRegistration, "id">),
        };
        if (isSoftDeleted(row)) {
          skipped += 1;
          continue;
        }
        if (!row.email?.trim() && !row.phone?.trim()) {
          skipped += 1;
          continue;
        }
        const result = await syncWaitlistMemberToDatabasePerso(row, "[cold-outreach/backfill]");
        if (result.ok) synced += 1;
        else if (result.skipped) skipped += 1;
        else failed += 1;
      }
      return NextResponse.json({
        ok: true,
        action: "backfill-inscrits",
        synced,
        failed,
        skipped,
        total: snap.size,
      });
    } catch (error) {
      console.error("[admin/cold-outreach backfill]", error);
      return NextResponse.json({ ok: false, error: "backfill_failed" }, { status: 502 });
    }
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const { templateKey, locale, dryRun } = parsed.data;
  if (!isCustomEmailTemplateKey(templateKey)) {
    return NextResponse.json(
      { ok: false, error: "custom_template_required" },
      { status: 400 },
    );
  }

  try {
    const listed = await listLaMesaToContact();
    if (!listed.ok) {
      return NextResponse.json({ ok: false, error: "perso_list_failed" }, { status: 502 });
    }
    const waitlistEmails = await loadWaitlistEmails();
    const idFilter = parsed.data.contactIds?.length
      ? new Set(parsed.data.contactIds)
      : null;

    const targets = listed.contacts
      .filter((c) => !idFilter || idFilter.has(c.id))
      .map((c) => ({
        id: c.id,
        fullName: c.fullName,
        email: firstEmail(c.emails),
      }))
      .filter((c) => c.email.includes("@") && !waitlistEmails.has(c.email));

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        count: targets.length,
        recipients: targets,
      });
    }

    const results: Array<{
      contactId: string;
      email: string;
      ok: boolean;
      skipped?: boolean;
      reason?: string;
      error?: string;
    }> = [];
    const marked: string[] = [];

    for (const target of targets) {
      const mail = await sendColdTemplateEmail({
        templateKey,
        locale,
        to: target.email,
        fullName: target.fullName || target.email,
      });
      if (!mail.ok) {
        results.push({
          contactId: target.id,
          email: target.email,
          ok: false,
          error: mail.error,
        });
        continue;
      }
      if ("skipped" in mail && mail.skipped) {
        results.push({
          contactId: target.id,
          email: target.email,
          ok: true,
          skipped: true,
          reason: mail.reason,
        });
        continue;
      }
      results.push({ contactId: target.id, email: target.email, ok: true });
      marked.push(target.id);
    }

    let mark: { ok: boolean; updated?: number } = { ok: true, updated: 0 };
    if (marked.length > 0) {
      mark = await markLaMesaContacted(marked);
    }

    const sent = results.filter((r) => r.ok && !r.skipped).length;
    const failed = results.filter((r) => !r.ok).length;
    const skipped = results.filter((r) => r.skipped).length;

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      skipped,
      markContacted: mark,
      results,
    });
  } catch (error) {
    console.error("[admin/cold-outreach send]", error);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }
}
