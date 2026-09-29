import type { DatabasePersoContact } from "@/lib/types/events";

const REQUEST_TIMEOUT_MS = 20_000;

export class DatabasePersoError extends Error {
  constructor(
    message: string,
    readonly code: "unconfigured" | "invalid_query" | "unauthorized" | "upstream" | "timeout",
    readonly status?: number,
  ) {
    super(message);
    this.name = "DatabasePersoError";
  }
}

function getConfig() {
  const baseUrl = process.env.DATABASE_PERSO_BASE_URL?.trim().replace(/\/$/, "");
  const token = process.env.DATABASE_PERSO_API_TOKEN?.trim();
  if (!baseUrl || !token) {
    throw new DatabasePersoError(
      "DATABASE_PERSO_BASE_URL and DATABASE_PERSO_API_TOKEN are required.",
      "unconfigured",
    );
  }
  return { baseUrl, token };
}

async function fetchDatabasePerso<T>(
  path: string,
  options?: { method?: string; body?: unknown; auth?: boolean },
): Promise<T> {
  const { baseUrl, token } = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (options?.auth !== false) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: options?.method ?? "GET",
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const body = await res.text().catch(() => "");

    if (res.status === 401) {
      throw new DatabasePersoError(
        "Perso a rejeté le token (401). Aligner DATABASE_PERSO_API_TOKEN LA MESA ↔ database-perso puis redeploy.",
        "unauthorized",
        401,
      );
    }
    if (!res.ok) {
      throw new DatabasePersoError(
        `Upstream error ${res.status}: ${body.slice(0, 200)}`,
        "upstream",
        res.status,
      );
    }

    return JSON.parse(body || "{}") as T;
  } catch (error) {
    if (error instanceof DatabasePersoError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new DatabasePersoError("Request timeout", "timeout");
    }
    throw new DatabasePersoError(
      error instanceof Error ? error.message : "Network error",
      "upstream",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeContact(raw: unknown): DatabasePersoContact | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const id = typeof c.id === "string" ? c.id : null;
  const fullName = typeof c.fullName === "string" ? c.fullName : null;
  if (!id || !fullName) return null;

  return {
    id,
    fullName,
    company: stringOrNull(c.company),
    emails: stringArray(c.emails),
    phones: stringArray(c.phones),
    tags: stringArray(c.tags),
    linkedinUrl: stringOrNull(c.linkedinUrl),
    sector: stringOrNull(c.sector),
    position: stringOrNull(c.position),
    city: stringOrNull(c.city),
    notes: stringOrNull(c.notes),
    keywords: stringArray(c.keywords),
    extraActivities: stringArray(c.extraActivities),
    updatedAt: stringOrNull(c.updatedAt) ?? stringOrNull(c.updated_at),
  };
}

export async function searchContacts(query: string): Promise<DatabasePersoContact[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const data = await fetchDatabasePerso<{ ok?: boolean; results?: unknown[] }>(
    `/api/public/contacts/search?q=${encodeURIComponent(q)}`,
  );

  if (!Array.isArray(data.results)) return [];

  return data.results
    .map(normalizeContact)
    .filter((c): c is DatabasePersoContact => c !== null);
}

/** Best-effort lookup by email (Perso search). Exact email match preferred. */
export async function findContactByEmail(email: string): Promise<DatabasePersoContact | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return null;

  const results = await searchContacts(normalized);
  const exact = results.find((contact) =>
    contact.emails.some((item) => item.trim().toLowerCase() === normalized),
  );
  return exact ?? results[0] ?? null;
}

export type UpsertContactPayload = {
  fullName: string;
  linkedinUrl?: string;
  emails: string[];
  phones: string[];
  company?: string;
  sector?: string;
  position?: string;
  keywords?: string[];
  extraActivities?: string[];
  city?: string;
  tags: string[];
  source: string;
  locale: string;
  notes?: string;
  /** After upsert: move to LA MESA - INSCRITS, leave LA MESA - CONTACTER */
  laMesaRegistered?: boolean;
  /**
   * Perso merge policy. `prefer_incoming` = LA MESA non-empty fields overwrite
   * existing Perso values (newest LA MESA write wins). Notes still append-friendly
   * when Perso supports `notesMode`.
   */
  mergePolicy?: "fill_empty" | "prefer_incoming";
  notesMode?: "replace" | "append" | "fill_empty";
  /** ISO stamp of the LA MESA profile write that triggered this upsert. */
  sourceUpdatedAt?: string;
};

export type LaMesaOutreachContact = {
  id: string;
  fullName: string;
  company: string | null;
  emails: string[];
  phones: string[];
  tags: string[];
};

export async function upsertContact(
  payload: UpsertContactPayload,
): Promise<{
  ok: boolean;
  id?: string;
  action?: "created" | "merged";
  lists?: { ok?: boolean; error?: string };
}> {
  try {
    const data = await fetchDatabasePerso<{
      ok?: boolean;
      id?: string;
      action?: "created" | "merged";
      lists?: { ok?: boolean; error?: string };
    }>("/api/public/contacts/upsert", { method: "POST", body: payload });
    return {
      ok: data.ok === true,
      id: data.id,
      action: data.action,
      lists: data.lists,
    };
  } catch (error) {
    if (error instanceof DatabasePersoError && error.status === 404) {
      return { ok: false };
    }
    throw error;
  }
}

/** Bootstrap Perso playlists LA MESA - INSCRITS / CONTACTER. */
export async function ensureLaMesaLists(): Promise<{ ok: boolean }> {
  try {
    const data = await fetchDatabasePerso<{ ok?: boolean }>(
      "/api/public/lists/la-mesa/ensure",
      { method: "POST", body: {} },
    );
    return { ok: data.ok === true };
  } catch (error) {
    if (error instanceof DatabasePersoError && error.status === 404) {
      return { ok: false };
    }
    throw error;
  }
}

/** Contacts on CONTACTER with action A CONTACTER (not CONTACTÉ). */
export async function listLaMesaToContact(): Promise<{
  ok: boolean;
  contacts: LaMesaOutreachContact[];
  count: number;
}> {
  try {
    const data = await fetchDatabasePerso<{
      ok?: boolean;
      contacts?: LaMesaOutreachContact[];
      count?: number;
    }>("/api/public/lists/la-mesa/to-contact");
    return {
      ok: data.ok === true,
      contacts: Array.isArray(data.contacts) ? data.contacts : [],
      count: typeof data.count === "number" ? data.count : 0,
    };
  } catch (error) {
    if (error instanceof DatabasePersoError && error.status === 404) {
      return { ok: false, contacts: [], count: 0 };
    }
    throw error;
  }
}

/** After cold mail: CONTACTÉ on, A CONTACTER off (by Perso ids and/or emails). */
export async function markLaMesaContacted(
  contactIds: string[],
  emails: string[] = [],
): Promise<{
  ok: boolean;
  updated?: number;
  addedToList?: number;
  unmatched?: number;
}> {
  try {
    const data = await fetchDatabasePerso<{
      ok?: boolean;
      updated?: number;
      addedToList?: number;
      unmatched?: number;
    }>("/api/public/lists/la-mesa/mark-contacted", {
      method: "POST",
      body: { contactIds, emails },
    });
    return {
      ok: data.ok === true,
      updated: data.updated,
      addedToList: data.addedToList,
      unmatched: data.unmatched,
    };
  } catch (error) {
    if (error instanceof DatabasePersoError && error.status === 404) {
      return { ok: false };
    }
    throw error;
  }
}

/** Manual email → CONTACTER + A CONTACTER. */
export async function addLaMesaToContacter(input: {
  email: string;
  fullName?: string;
  company?: string;
  phone?: string;
}): Promise<{
  ok: boolean;
  contactId?: string;
  email?: string;
  fullName?: string;
  error?: string;
}> {
  try {
    const data = await fetchDatabasePerso<{
      ok?: boolean;
      contactId?: string;
      email?: string;
      fullName?: string;
      error?: string;
      message?: string;
    }>("/api/public/lists/la-mesa/add-to-contacter", {
      method: "POST",
      body: input,
    });
    return {
      ok: data.ok === true,
      contactId: data.contactId,
      email: data.email,
      fullName: data.fullName,
      error: data.error ?? data.message,
    };
  } catch (error) {
    if (error instanceof DatabasePersoError && error.status === 404) {
      return { ok: false, error: "not_found" };
    }
    throw error;
  }
}

export function isDatabasePersoConfigured(): boolean {
  return !!(
    process.env.DATABASE_PERSO_BASE_URL?.trim() &&
    process.env.DATABASE_PERSO_API_TOKEN?.trim()
  );
}

/** Prefer production alias without Vercel SSO (team *.vercel.app URLs often 401). */
export function getDatabasePersoBaseUrl(): string | null {
  try {
    return getConfig().baseUrl;
  } catch {
    return null;
  }
}
