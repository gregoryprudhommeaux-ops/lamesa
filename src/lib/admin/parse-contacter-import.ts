export type ContacterImportRow = {
  email: string;
  fullName?: string;
  company?: string;
  phone?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase().replace(/^mailto:/i, "");
}

function splitLine(line: string): string[] {
  // Support CSV with commas or tabs; keep simple (no nested quotes complexity beyond paired quotes)
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
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

function pickEmail(cells: string[]): string | null {
  for (const cell of cells) {
    const e = normalizeEmail(cell.replace(/^<|>$/g, ""));
    if (EMAIL_RE.test(e)) return e;
  }
  // "Name <email@x.com>"
  for (const cell of cells) {
    const m = cell.match(/<([^>]+@[^>]+)>/);
    if (m?.[1] && EMAIL_RE.test(normalizeEmail(m[1]))) return normalizeEmail(m[1]);
  }
  return null;
}

/**
 * Parse pasted text: one email per line, or CSV/TSV `name,email` / `email,name,company`.
 */
export function parseContacterImportText(raw: string): ContacterImportRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  let start = 0;
  let emailIdx = -1;
  let nameIdx = -1;
  let companyIdx = -1;
  let phoneIdx = -1;

  const firstCells = splitLine(lines[0]!);
  if (looksLikeHeader(firstCells)) {
    start = 1;
    firstCells.forEach((h, i) => {
      const k = h.toLowerCase();
      if (emailIdx < 0 && (k.includes("email") || k.includes("correo") || k === "mail")) {
        emailIdx = i;
      }
      if (
        nameIdx < 0 &&
        (k.includes("name") || k.includes("nom") || k.includes("nombre") || k === "full name")
      ) {
        nameIdx = i;
      }
      if (companyIdx < 0 && (k.includes("company") || k.includes("empresa") || k.includes("société"))) {
        companyIdx = i;
      }
      if (phoneIdx < 0 && (k.includes("phone") || k.includes("tel") || k.includes("whatsapp"))) {
        phoneIdx = i;
      }
    });
  }

  const out: ContacterImportRow[] = [];
  const seen = new Set<string>();

  for (let i = start; i < lines.length; i++) {
    const cells = splitLine(lines[i]!);
    let email: string | null = null;
    let fullName: string | undefined;
    let company: string | undefined;
    let phone: string | undefined;

    if (emailIdx >= 0) {
      email = cells[emailIdx] ? normalizeEmail(cells[emailIdx]!) : null;
      if (email && !EMAIL_RE.test(email)) email = null;
      if (nameIdx >= 0 && cells[nameIdx]?.trim()) fullName = cells[nameIdx]!.trim();
      if (companyIdx >= 0 && cells[companyIdx]?.trim()) company = cells[companyIdx]!.trim();
      if (phoneIdx >= 0 && cells[phoneIdx]?.trim()) phone = cells[phoneIdx]!.trim();
    } else if (cells.length === 1) {
      email = pickEmail(cells);
    } else {
      email = pickEmail(cells);
      // Heuristic: non-email first cell = name
      const maybeName = cells.find((c) => c && !c.includes("@"));
      if (maybeName) fullName = maybeName.trim();
      const maybeCompany = cells.find(
        (c, idx) => idx > 0 && c && !c.includes("@") && c !== maybeName,
      );
      if (maybeCompany) company = maybeCompany.trim();
    }

    if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.push({
      email,
      ...(fullName ? { fullName } : {}),
      ...(company ? { company } : {}),
      ...(phone ? { phone } : {}),
    });
  }

  return out;
}
