import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import { sendColdTemplateEmail } from "@/lib/email/send-cold-template";
import { isCustomEmailTemplateKey } from "@/lib/email/template-defaults";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";
import {
  listProspects,
  markProspectsContacted,
} from "@/lib/prospects/store";
import { listProspectLists } from "@/lib/prospects/lists-store";
import { isEligibleForTemplateCampaign } from "@/lib/prospects/campaign-eligibility";
import type { WaitlistRegistration } from "@/lib/types/events";

const SEND_BATCH_LIMIT = 50;

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

/**
 * Recipients for cold UI.
 * - Default: status=to_contact, waitlist emails excluded.
 * - ?list=NAME: members of that Prospects playlist (any status); waitlist not excluded
 *   (needed for « MEMBRES INSCRITS » dedicated mailings).
 */
export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const listName = url.searchParams.get("list")?.trim() || "";
  const templateKey = url.searchParams.get("templateKey")?.trim() || "";

  try {
    const [prospects, waitlistEmails, lists] = await Promise.all([
      listName
        ? listProspects({ list: listName, limit: 3000 })
        : listProspects({ status: "to_contact", limit: 3000 }),
      loadWaitlistEmails(),
      listProspectLists(),
    ]);

    const excludeWaitlist = !listName;

    const recipients = prospects
      .map((p) => ({
        id: p.id,
        fullName: p.fullName || p.email,
        email: p.email,
        company: p.company || null,
        status: p.status,
        alreadyOnWaitlist: waitlistEmails.has(p.email),
      }))
      .filter((r) => r.email.includes("@"));

    const waitlistEligible = excludeWaitlist
      ? recipients.filter((r) => !r.alreadyOnWaitlist)
      : recipients;
    const eligible = waitlistEligible.filter((r) =>
      isEligibleForTemplateCampaign(
        prospects.find((p) => p.id === r.id) ?? {},
        templateKey,
      ),
    );
    const skippedWaitlist = excludeWaitlist
      ? recipients.filter((r) => r.alreadyOnWaitlist)
      : [];
    const alreadySent = waitlistEligible.filter(
      (r) =>
        !isEligibleForTemplateCampaign(
          prospects.find((p) => p.id === r.id) ?? {},
          templateKey,
        ),
    );

    return NextResponse.json({
      ok: true,
      source: "la_mesa_prospects",
      statusFilter: listName ? null : "to_contact",
      listFilter: listName || null,
      excludeWaitlist,
      batchLimit: SEND_BATCH_LIMIT,
      count: eligible.length,
      recipients: eligible,
      skippedWaitlist,
      alreadySent,
      lists: lists.map((l) => ({
        id: l.id,
        name: l.name,
        contactCount: l.contactCount,
      })),
    });
  } catch (error) {
    console.error("[admin/cold-outreach GET]", error);
    return NextResponse.json(
      {
        ok: false,
        error: "fetch_failed",
        detail: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
      },
      { status: 502 },
    );
  }
}

const manualSendSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().max(200).optional(),
  templateKey: z.string().min(1),
  locale: z.enum(["es", "fr", "en"]).default("es"),
});

const sendSchema = z.object({
  templateKey: z.string().min(1),
  locale: z.enum(["es", "fr", "en"]).default("es"),
  contactIds: z.array(z.string().min(1)).optional(),
  dryRun: z.boolean().optional(),
});

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
      ? String((body as { action?: string }).action ?? "send")
      : "send";

  if (action === "send_manual") {
    const parsed = manualSendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }
    if (!isCustomEmailTemplateKey(parsed.data.templateKey)) {
      return NextResponse.json(
        { ok: false, error: "custom_template_required" },
        { status: 400 },
      );
    }
    try {
      const email = parsed.data.email.trim().toLowerCase();
      const result = await sendColdTemplateEmail({
        templateKey: parsed.data.templateKey,
        locale: parsed.data.locale,
        to: email,
        fullName: parsed.data.fullName?.trim() || email,
      });
      if ("skipped" in result && result.skipped) {
        return NextResponse.json({
          ok: true,
          sent: 0,
          skipped: 1,
          reason: result.reason,
        });
      }
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: "error" in result ? result.error : "send_failed" },
          { status: 502 },
        );
      }
      return NextResponse.json({ ok: true, sent: 1, skipped: 0, email });
    } catch (error) {
      console.error("[admin/cold-outreach send_manual]", error);
      return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
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
    const waitlistEmails = await loadWaitlistEmails();
    const idFilter = parsed.data.contactIds?.length
      ? new Set(parsed.data.contactIds)
      : null;

    // Explicit IDs (list/selection) → any status, keep waitlist members.
    // Default cold pool → to_contact only, exclude waitlist.
    const prospects = idFilter
      ? await listProspects({ limit: 3000 })
      : await listProspects({ status: "to_contact", limit: 3000 });

    let targets = prospects
      .filter((p) => !idFilter || idFilter.has(p.id))
      .filter((p) => p.email.includes("@"))
      .filter((p) => (idFilter ? true : !waitlistEmails.has(p.email)))
      .map((p) => ({
        id: p.id,
        fullName: p.fullName || p.email,
        email: p.email,
        previousStatus: p.status,
      }));

    if (targets.length > SEND_BATCH_LIMIT) {
      targets = targets.slice(0, SEND_BATCH_LIMIT);
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        count: targets.length,
        batchLimit: SEND_BATCH_LIMIT,
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
    const succeededIds: string[] = [];

    for (const t of targets) {
      const sent = await sendColdTemplateEmail({
        templateKey,
        locale,
        to: t.email,
        fullName: t.fullName,
      });
      if ("skipped" in sent && sent.skipped) {
        results.push({
          contactId: t.id,
          email: t.email,
          ok: true,
          skipped: true,
          reason: sent.reason,
        });
        continue;
      }
      if (!sent.ok) {
        results.push({
          contactId: t.id,
          email: t.email,
          ok: false,
          error: "error" in sent ? sent.error : "send_failed",
        });
        continue;
      }
      results.push({ contactId: t.id, email: t.email, ok: true });
      succeededIds.push(t.id);
      void import("@/lib/contacts/activities-store").then(({ recordContactActivity }) =>
        recordContactActivity({
          email: t.email,
          type: "email_sent",
          source: "admin",
          summary: `Cold email · ${templateKey}`,
          refs: { prospectId: t.id, templateKey },
        }),
      );
    }

    if (succeededIds.length > 0) {
      await markProspectsContacted(succeededIds, templateKey);
      for (const id of succeededIds) {
        const p = targets.find((t) => t.id === id);
        if (!p) continue;
        if (p.previousStatus === "won" || p.previousStatus === "do_not_contact") continue;
        void import("@/lib/contacts/activities-store").then(({ recordContactActivity }) =>
          recordContactActivity({
            email: p.email,
            type: "status_changed",
            source: "admin",
            summary: "Statut → Contacté (cold)",
            refs: { prospectId: id },
            meta: { status: "contacted" },
          }),
        );
      }
    }

    return NextResponse.json({
      ok: true,
      sent: results.filter((r) => r.ok && !r.skipped).length,
      skipped: results.filter((r) => r.skipped).length,
      failed: results.filter((r) => !r.ok).length,
      batchLimit: SEND_BATCH_LIMIT,
      results,
    });
  } catch (error) {
    console.error("[admin/cold-outreach send]", error);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }
}
