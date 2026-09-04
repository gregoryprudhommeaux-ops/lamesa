/**
 * Build Prospect list: French waitlist members whose role fits the
 * dirigeants / entrepreneurs dinner shortlist.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/build-french-dirigeants-shortlist.ts
 *   node --env-file=.env.local --import tsx scripts/build-french-dirigeants-shortlist.ts --dry-run
 */
import { writeFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { isFranconetworkMember } from "../src/lib/member/franconetwork-member";
import { isSoftDeleted } from "../src/lib/member/soft-delete";
import { createProspectList } from "../src/lib/prospects/lists-store";
import {
  findProspectByEmail,
  updateProspect,
  upsertProspect,
} from "../src/lib/prospects/store";
import { labelPositionFr } from "../src/lib/admin/waitlist-labels-fr";
import type { WaitlistRegistration } from "../src/lib/types/events";

const LIST_NAME = "STD dirigeants-fr-2026-09-24 — SHORTLIST FR";
const DRY_RUN = process.argv.includes("--dry-run");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!PROJECT_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error("Missing FIREBASE_* env");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: PROJECT_ID,
      clientEmail: CLIENT_EMAIL,
      privateKey: PRIVATE_KEY,
    }),
  });
}

const dbId = process.env.FIREBASE_FIRESTORE_DATABASE_ID?.trim() || "(default)";
const db = dbId === "(default)" ? getFirestore() : getFirestore(dbId);

/** Canonical codes that match the first dinner. */
const MATCH_CODES = new Set(["founder", "ceo", "director", "investor"]);

/**
 * Free-text / FN titles that still signal dirigeant / entrepreneur / VP.
 * "other" alone is not enough — need a senior signal in the string.
 */
const ROLE_RE =
  /\b(founder|fondateur|fondatrice|co-?founder|co-?fondateur|ceo|c\.?e\.?o\.?|dg\b|directeur|directora|director|directrice|direction g[eé]n[eé]rale|managing director|md\b|vp\b|vice[-\s]?president|vice[-\s]?pr[eé]sident|president|pr[eé]sident|presidente|entrepreneur|empresario|owner|owner-operator|g[eé]rant|associ[eé] fondateur|asociado fundador|partner\b|general manager|gm\b|head of|chief |c-level|cfo|coo|cto|cmo|strat[eé]gie\s*\/?\s*corporate)\b/i;

/** Organizer — keep out of outreach shortlist. */
const EXCLUDE_EMAILS = new Set(["greg@nextstep-services.com", "gregory.prudhommeaux@gmail.com"]);

function normalizePos(raw: string): string {
  return raw.trim().toLowerCase();
}

function isFrenchSignal(m: WaitlistRegistration): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (isFranconetworkMember(m)) reasons.push("franconetwork");
  if ((m.locale ?? "").trim().toLowerCase() === "fr") reasons.push("locale:fr");
  const tags = (m.tags ?? []).map((t) => String(t).toLowerCase());
  if (tags.some((t) => t.includes("french") || t.includes("francais") || t.includes("français"))) {
    reasons.push("tag:french");
  }
  return { ok: reasons.length > 0, reasons };
}

function roleMatch(positionRaw: string): { ok: boolean; reason: string } {
  const pos = normalizePos(positionRaw);
  if (!pos) return { ok: false, reason: "empty" };
  if (MATCH_CODES.has(pos)) return { ok: true, reason: `code:${pos}` };
  if (ROLE_RE.test(positionRaw)) return { ok: true, reason: `text:${positionRaw.trim()}` };
  return { ok: false, reason: `no-match:${pos}` };
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

async function main() {
  const snap = await db.collection("la_mesa_waitlist").limit(2000).get();
  const members = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<WaitlistRegistration, "id">),
  }));

  type Row = {
    id: string;
    fullName: string;
    email: string;
    company: string;
    position: string;
    positionLabel: string;
    city: string;
    phone: string;
    linkedinUrl: string;
    locale: string;
    source: string;
    frenchReasons: string;
    roleReason: string;
    profileComplete: boolean;
  };

  const selected: Row[] = [];
  const frenchWrongRole: Array<{ name: string; email: string; position: string }> = [];
  const roleNotFrench: Array<{ name: string; email: string; position: string; locale: string }> =
    [];

  for (const m of members) {
    if (isSoftDeleted(m)) continue;
    const email = (m.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    if (EXCLUDE_EMAILS.has(email)) continue;

    const french = isFrenchSignal(m);
    const role = roleMatch(String(m.position ?? ""));

    if (french.ok && role.ok) {
      selected.push({
        id: m.id,
        fullName: m.fullName ?? "",
        email,
        company: m.company ?? "",
        position: m.position ?? "",
        positionLabel: labelPositionFr(m.position),
        city: m.city ?? "",
        phone: m.phone ?? "",
        linkedinUrl: m.linkedinUrl ?? "",
        locale: m.locale ?? "",
        source: m.source ?? "",
        frenchReasons: french.reasons.join("+"),
        roleReason: role.reason,
        profileComplete: m.profileComplete !== false,
      });
      continue;
    }

    if (french.ok && !role.ok) {
      frenchWrongRole.push({
        name: m.fullName ?? "",
        email,
        position: String(m.position ?? ""),
      });
    }
    if (!french.ok && role.ok && (m.locale ?? "").toLowerCase() === "es") {
      // skip noise
    } else if (!french.ok && role.ok) {
      roleNotFrench.push({
        name: m.fullName ?? "",
        email,
        position: String(m.position ?? ""),
        locale: m.locale ?? "",
      });
    }
  }

  selected.sort((a, b) => a.fullName.localeCompare(b.fullName, "fr"));

  console.log(`Waitlist scanned: ${members.length}`);
  console.log(`SHORTLIST FR dirigeants-fit: ${selected.length}`);
  console.log(`French but role excluded: ${frenchWrongRole.length}`);
  if (frenchWrongRole.length) {
    console.log(
      frenchWrongRole
        .map((r) => `  - ${r.name} <${r.email}> · ${r.position || "(vide)"}`)
        .join("\n"),
    );
  }

  const csvHeader = [
    "fullName",
    "email",
    "company",
    "position",
    "positionLabel",
    "city",
    "phone",
    "linkedinUrl",
    "locale",
    "source",
    "frenchReasons",
    "roleReason",
    "profileComplete",
    "waitlistId",
  ];
  const csvLines = [
    csvHeader.join(","),
    ...selected.map((r) =>
      [
        r.fullName,
        r.email,
        r.company,
        r.position,
        r.positionLabel,
        r.city,
        r.phone,
        r.linkedinUrl,
        r.locale,
        r.source,
        r.frenchReasons,
        r.roleReason,
        String(r.profileComplete),
        r.id,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  const outPath = `/tmp/shortlist-dirigeants-fr-2026-09.csv`;
  writeFileSync(outPath, csvLines.join("\n"), "utf8");
  console.log(`CSV written: ${outPath}`);

  if (DRY_RUN) {
    console.log("Dry run — no Prospect list write");
    for (const r of selected) {
      console.log(`• ${r.fullName} | ${r.email} | ${r.positionLabel} | ${r.city}`);
    }
    return;
  }

  const created = await createProspectList(LIST_NAME);
  if (!created.ok) {
    console.error("createProspectList failed", created);
    process.exit(1);
  }
  console.log("Prospect list:", created.list.name, created.list.id);

  let synced = 0;
  for (const r of selected) {
    const existing = await findProspectByEmail(r.email);
    const notesBit = `Shortlist dîner dirigeants FR 24/09 — ${r.roleReason}; ${r.frenchReasons}`;
    if (existing) {
      await updateProspect(existing.id, {
        fullName: r.fullName || existing.fullName,
        company: r.company || existing.company,
        position: r.position || existing.position,
        city: r.city || existing.city,
        phone: r.phone || existing.phone,
        linkedin: r.linkedinUrl || existing.linkedin,
        lists: uniq([...(existing.lists ?? []), LIST_NAME]),
        tags: uniq([...(existing.tags ?? []), "shortlist-dirigeants-fr", "inscrit"]),
        notes: existing.notes?.includes("Shortlist dîner dirigeants")
          ? existing.notes
          : [existing.notes, notesBit].filter(Boolean).join("\n"),
        status: existing.status === "do_not_contact" ? undefined : "to_contact",
      });
    } else {
      await upsertProspect(
        {
          email: r.email,
          fullName: r.fullName,
          company: r.company,
          position: r.position,
          city: r.city,
          phone: r.phone,
          linkedin: r.linkedinUrl,
          lists: [LIST_NAME],
          tags: ["shortlist-dirigeants-fr", "inscrit"],
          notes: notesBit,
          status: "to_contact",
          source: r.source || "waitlist-shortlist",
        },
        { source: r.source || "waitlist-shortlist" },
      );
    }
    synced += 1;
  }

  console.log(`Prospects synced onto list: ${synced}`);
  console.log(`Admin → Prospects → liste « ${LIST_NAME} »`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
