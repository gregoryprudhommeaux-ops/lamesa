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
  upsertProspect,
} from "@/lib/prospects/store";
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

/** Recipients: internal prospects status=to_contact, minus waitlist. */
export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  try {
    const [prospects, waitlistEmails] = await Promise.all([
      listProspects({ status: "to_contact", limit: 3000 }),
      loadWaitlistEmails(),
    ]);

    const recipients = prospects
      .map((p) => ({
        id: p.id,
        fullName: p.fullName || p.email,
        email: p.email,
        company: p.company || null,
        alreadyOnWaitlist: waitlistEmails.has(p.email),
      }))
      .filter((r) => r.email.includes("@"));

    const eligible = recipients.filter((r) => !r.alreadyOnWaitlist);
    const skippedWaitlist = recipients.filter((r) => r.alreadyOnWaitlist);

    return NextResponse.json({
      ok: true,
      source: "la_mesa_prospects",
      statusFilter: "to_contact",
      batchLimit: SEND_BATCH_LIMIT,
      count: eligible.length,
      recipients: eligible,
      skippedWaitlist,
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
      const result = await upsertProspect({
        email,
        fullName: parsed.data.fullName,
        company: parsed.data.company,
        phone: parsed.data.phone,
        status: "to_contact",
        source: "cold-manual",
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, contact: result.prospect, action: result.action });
    } catch (error) {
      console.error("[admin/cold-outreach add]", error);
      return NextResponse.json({ ok: false, error: "add_failed" }, { status: 502 });
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
    const [prospects, waitlistEmails] = await Promise.all([
      listProspects({ status: "to_contact", limit: 3000 }),
      loadWaitlistEmails(),
    ]);
    const idFilter = parsed.data.contactIds?.length
      ? new Set(parsed.data.contactIds)
      : null;

    let targets = prospects
      .filter((p) => !idFilter || idFilter.has(p.id))
      .filter((p) => p.email.includes("@") && !waitlistEmails.has(p.email))
      .map((p) => ({ id: p.id, fullName: p.fullName || p.email, email: p.email }));

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
      await markProspectsContacted(succeededIds);
      for (const id of succeededIds) {
        const p = targets.find((t) => t.id === id);
        if (!p) continue;
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
