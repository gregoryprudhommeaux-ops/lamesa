/**
 * Parse pasted CSV/TSV or Google Sheet export text into prospect rows.
 * Rows without a valid email are dropped.
 */

import type { ProspectImportRow } from "@/lib/types/prospects";
import { isValidProspectEmail, normalizeProspectEmail } from "@/lib/prospects/normalize";

function splitLine(line: string): string[] {
  if (line.includes("\t") && !line.includes(",")) {
    return line.split("\t").map((c) => c.trim());
  }
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function looksLikeHeader(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  return (
    joined.includes("email") ||
    joined.includes("correo") ||
    joined.includes("mail") ||
    (joined.includes("nom") && joined.includes("email"))
  );
}

function headerIndex(cells: string[], preds: ((k: string) => boolean)[]): number {
  for (let i = 0; i < cells.length; i++) {
    const k = cells[i]!.toLowerCase().trim();
    if (preds.some((p) => p(k))) return i;
  }
  return -1;
}

export function parseProspectImportText(raw: string): ProspectImportRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  let start = 0;
  let emailIdx = -1;
  let nameIdx = -1;
  let companyIdx = -1;
  let positionIdx = -1;
  let sectorIdx = -1;
  let cityIdx = -1;
  let linkedinIdx = -1;
  let phoneIdx = -1;

  const firstCells = splitLine(lines[0]!);
  if (looksLikeHeader(firstCells)) {
    start = 1;
    emailIdx = headerIndex(firstCells, [
      (k) => k.includes("email") || k.includes("correo") || k === "mail",
    ]);
    nameIdx = headerIndex(firstCells, [
      (k) =>
        k.includes("name") ||
        k.includes("nom") ||
        k.includes("nombre") ||
        k === "full name",
    ]);
    companyIdx = headerIndex(firstCells, [
      (k) => k.includes("company") || k.includes("empresa") || k.includes("société") || k.includes("societe"),
    ]);
    positionIdx = headerIndex(firstCells, [
      (k) =>
        k.includes("position") ||
        k.includes("poste") ||
        k.includes("title") ||
        k.includes("cargo") ||
        k.includes("job"),
    ]);
    sectorIdx = headerIndex(firstCells, [
      (k) =>
        k.includes("sector") ||
        k.includes("secteur") ||
        k.includes("industrie") ||
        k.includes("industry"),
    ]);
    cityIdx = headerIndex(firstCells, [
      (k) => k.includes("city") || k.includes("ville") || k.includes("ciudad"),
    ]);
    linkedinIdx = headerIndex(firstCells, [(k) => k.includes("linkedin")]);
    phoneIdx = headerIndex(firstCells, [
      (k) => k.includes("phone") || k.includes("tel") || k.includes("whatsapp"),
    ]);
  }

  const out: ProspectImportRow[] = [];
  const seen = new Set<string>();

  for (let i = start; i < lines.length; i++) {
    const cells = splitLine(lines[i]!);
    let email = "";
    if (emailIdx >= 0) {
      email = normalizeProspectEmail(cells[emailIdx] ?? "");
    } else {
      email =
        cells.map((c) => normalizeProspectEmail(c)).find((e) => isValidProspectEmail(e)) ?? "";
    }
    if (!isValidProspectEmail(email) || seen.has(email)) continue;
    seen.add(email);

    const cell = (idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");
    const row: ProspectImportRow = { email };
    const fullName =
      nameIdx >= 0
        ? cell(nameIdx)
        : cells.find((c) => c && !c.includes("@") && normalizeProspectEmail(c) !== email)?.trim();
    if (fullName) row.fullName = fullName;
    if (companyIdx >= 0 && cell(companyIdx)) row.company = cell(companyIdx);
    if (positionIdx >= 0 && cell(positionIdx)) row.position = cell(positionIdx);
    if (sectorIdx >= 0 && cell(sectorIdx)) row.sector = cell(sectorIdx);
    if (cityIdx >= 0 && cell(cityIdx)) row.city = cell(cityIdx);
    if (linkedinIdx >= 0 && cell(linkedinIdx)) row.linkedin = cell(linkedinIdx);
    if (phoneIdx >= 0 && cell(phoneIdx)) row.phone = cell(phoneIdx);
    out.push(row);
  }

  return out;
}

/** Convert a Google Sheets edit/view URL to public CSV export URL. */
export function googleSheetToCsvExportUrl(url: string): string | null {
  const trimmed = url.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch?.[1]) return null;
  const id = idMatch[1];
  const gidMatch = trimmed.match(/[?#&]gid=([0-9]+)/);
  const gid = gidMatch?.[1] ?? "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}
