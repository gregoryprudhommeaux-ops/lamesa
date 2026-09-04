/**
 * Merge Google Sheet FR dirigeants into SHORTLIST FR prospect list.
 * Option A: add all (except test emails); one CRM card per person; merge clear dups.
 *
 *   node --env-file=.env.local --import tsx scripts/merge-sheet-into-fr-shortlist.ts
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createProspectList } from "../src/lib/prospects/lists-store";
import { mergeProspectDocs, updateProspect } from "../src/lib/prospects/store";

const LIST = "STD dirigeants-fr-2026-09-24 — SHORTLIST FR";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!PROJECT_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error("Missing FIREBASE_*");
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

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (c !== "\r") cur += c;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const normEmail = (e: string) => e.trim().toLowerCase();
const normPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d ? (d.length > 10 ? d.slice(-10) : d) : "";
};
const normName = (n: string) =>
  n
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

type SheetRow = {
  fullName: string;
  emails: string[];
  company: string;
  position: string;
  city: string;
  phones: string[];
  phonesNorm: string[];
  linkedin: string;
};

type ProspectLite = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  phoneNorm: string;
  lists: string[];
  tags: string[];
  company: string;
  position: string;
  city: string;
  linkedin: string;
  notes: string;
  status?: string;
};

async function main() {
  const rows = parseCsv(readFileSync("/tmp/sheet-fr.csv", "utf8"));
  const h = rows[0]!.map((x) => x.trim());
  const col = (n: string) => h.findIndex((x) => x.toLowerCase() === n.toLowerCase());
  const sheet: SheetRow[] = rows
    .slice(1)
    .map((r) => ({
      fullName: (r[col("Nom")] ?? "").trim(),
      emails: [r[col("Email")], r[col("Email 2")]]
        .map((e) => normEmail(e ?? ""))
        .filter((e) => e.includes("@")),
      company: (r[col("Société")] ?? "").trim(),
      position: (r[col("Poste")] ?? "").trim(),
      city: (r[col("Ville")] ?? "").trim(),
      phones: [r[col("Téléphone")], r[col("Téléphone 2")]]
        .map((p) => (p ?? "").trim())
        .filter(Boolean),
      phonesNorm: [r[col("Téléphone")], r[col("Téléphone 2")]]
        .map((p) => normPhone(p ?? ""))
        .filter(Boolean),
      linkedin: (r[col("LinkedIn")] ?? "").trim(),
    }))
    .filter((s) => s.fullName || s.emails.length);

  const prosp: ProspectLite[] = (
    await db.collection("la_mesa_prospects").limit(5000).get()
  ).docs
    .filter((d) => !d.data().deletedAt)
    .map((d) => {
      const x = d.data();
      return {
        id: d.id,
        email: normEmail(String(x.email ?? "")),
        fullName: String(x.fullName ?? ""),
        phone: String(x.phone ?? ""),
        phoneNorm: normPhone(String(x.phone ?? "")),
        lists: Array.isArray(x.lists) ? x.lists.map(String) : [],
        tags: Array.isArray(x.tags) ? x.tags.map(String) : [],
        company: String(x.company ?? ""),
        position: String(x.position ?? ""),
        city: String(x.city ?? ""),
        linkedin: String(x.linkedin ?? ""),
        notes: String(x.notes ?? ""),
        status: String(x.status ?? ""),
      };
    });

  const byId = new Map(prosp.map((p) => [p.id, p]));

  function hitsFor(s: SheetRow): Array<ProspectLite & { via: string[] }> {
    const out: Array<ProspectLite & { via: string[] }> = [];
    for (const p of prosp) {
      if (!byId.has(p.id)) continue; // dropped by merge
      const via: string[] = [];
      if (s.emails.includes(p.email)) via.push("email");
      if (p.phoneNorm && s.phonesNorm.includes(p.phoneNorm)) via.push("phone");
      if (normName(s.fullName) && normName(s.fullName) === normName(p.fullName)) via.push("name");
      if (!via.length) continue;
      out.push({ ...p, via });
    }
    return out;
  }

  function pickPrimary(s: SheetRow, hits: Array<ProspectLite & { via: string[] }>) {
    const onList = hits.find((h) =>
      h.lists.some((l) => l.trim().toLowerCase() === LIST.toLowerCase()),
    );
    if (onList) return onList;
    const primaryEmail = s.emails[0];
    const byPrimary = hits.find((h) => h.email === primaryEmail);
    if (byPrimary) return byPrimary;
    const byAnyEmail = hits.find((h) => h.via.includes("email"));
    if (byAnyEmail) return byAnyEmail;
    return hits[0]!;
  }

  await createProspectList(LIST);

  let added = 0;
  let already = 0;
  let skippedTest = 0;
  let merged = 0;
  const mergeLog: string[] = [];
  const addedNames: string[] = [];

  for (const s of sheet) {
    if (s.emails.some((e) => /@test\.com$/i.test(e))) {
      skippedTest += 1;
      continue;
    }
    const hits = hitsFor(s).filter((h) => byId.has(h.id));
    if (!hits.length) {
      console.warn("NO HIT", s.fullName, s.emails.join(","));
      continue;
    }
    const primary = pickPrimary(s, hits);
    const secondaries = hits.filter((h) => h.id !== primary.id);

    for (const sec of secondaries) {
      if (!byId.has(sec.id) || !byId.has(primary.id)) continue;
      const res = await mergeProspectDocs(primary.id, sec.id);
      if (res.ok) {
        merged += 1;
        mergeLog.push(`${sec.email} → ${primary.email} (${s.fullName})`);
        byId.delete(sec.id);
        // refresh primary from merge result
        byId.set(primary.id, {
          ...primary,
          ...res.prospect,
          phoneNorm: normPhone(res.prospect.phone),
        });
      } else {
        console.warn("merge failed", primary.email, sec.email, res.error);
      }
    }

    const snap = await db.collection("la_mesa_prospects").doc(primary.id).get();
    const data = snap.data() ?? {};
    const lists = Array.isArray(data.lists) ? data.lists.map(String) : [];
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    if (lists.some((l) => l.trim().toLowerCase() === LIST.toLowerCase())) {
      already += 1;
      continue;
    }

    const noteLine = `Ajout shortlist FR dirigeants depuis Sheet Google (${new Date().toISOString().slice(0, 10)}).`;
    const notes = String(data.notes ?? "").includes("shortlist FR dirigeants")
      ? String(data.notes ?? "")
      : [String(data.notes ?? "").trim(), noteLine].filter(Boolean).join("\n");

    await updateProspect(primary.id, {
      lists: uniq([...lists, LIST]),
      tags: uniq([...tags, "shortlist-dirigeants-fr", "sheet-francais-dirigeants"]),
      notes,
      fullName: String(data.fullName || s.fullName),
      company: String(data.company || s.company),
      position: String(data.position || s.position),
      city: String(data.city || s.city),
      phone: String(data.phone || s.phones[0] || ""),
      linkedin: String(data.linkedin || s.linkedin),
      status: data.status === "do_not_contact" ? undefined : "to_contact",
    });
    added += 1;
    addedNames.push(`${s.fullName} <${primary.email}>`);
  }

  const finalCount = (
    await db.collection("la_mesa_prospects").limit(5000).get()
  ).docs.filter((d) => {
    const x = d.data();
    if (x.deletedAt) return false;
    return (Array.isArray(x.lists) ? x.lists : []).some(
      (l: string) => String(l).trim().toLowerCase() === LIST.toLowerCase(),
    );
  }).length;

  console.log(
    JSON.stringify(
      {
        added,
        already,
        skippedTest,
        merged,
        mergeLog,
        finalListCount: finalCount,
        addedNames,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
