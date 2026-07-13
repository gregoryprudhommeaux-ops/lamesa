import type { DatabasePersoContact } from "@/lib/types/events";

const REQUEST_TIMEOUT_MS = 10_000;

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
  const baseUrl = process.env.DATABASE_PERSO_BASE_URL?.replace(/\/$/, "");
  const token = process.env.DATABASE_PERSO_API_TOKEN;
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
      throw new DatabasePersoError("Unauthorized", "unauthorized", 401);
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

function normalizeContact(raw: unknown): DatabasePersoContact | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const id = typeof c.id === "string" ? c.id : null;
  const fullName = typeof c.fullName === "string" ? c.fullName : null;
  if (!id || !fullName) return null;

  return {
    id,
    fullName,
    company: typeof c.company === "string" ? c.company : null,
    emails: Array.isArray(c.emails)
      ? c.emails.filter((e): e is string => typeof e === "string")
      : [],
    phones: Array.isArray(c.phones)
      ? c.phones.filter((p): p is string => typeof p === "string")
      : [],
    tags: Array.isArray(c.tags)
      ? c.tags.filter((t): t is string => typeof t === "string")
      : [],
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
};

export async function upsertContact(payload: UpsertContactPayload): Promise<{ ok: boolean; id?: string }> {
  try {
    const data = await fetchDatabasePerso<{ ok?: boolean; id?: string }>(
      "/api/public/contacts/upsert",
      { method: "POST", body: payload },
    );
    return { ok: data.ok === true, id: data.id };
  } catch (error) {
    if (error instanceof DatabasePersoError && error.status === 404) {
      return { ok: false };
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
