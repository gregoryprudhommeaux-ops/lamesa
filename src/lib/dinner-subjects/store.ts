import "server-only";

import { CITY_HUBS, DEFAULT_CITY_HUB, resolveCityHub } from "@/lib/constants/city-hubs";
import { buildDefaultDinnerSubjectSeeds } from "@/lib/dinner-subjects/defaults";
import {
  isValidPeriodMonth,
  subjectTimingBucket,
  type SubjectTimingBucket,
} from "@/lib/dinner-subjects/period";
import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type {
  DinnerSubject,
  DinnerSubjectLocale,
  DinnerSubjectStatus,
} from "@/lib/types/events";
import { buildSubjectI18nMaps } from "@/lib/dinner-subjects/translate";

export type DinnerSubjectInput = {
  title: string;
  summary?: string;
  periodMonth: string;
  city?: string;
  status?: DinnerSubjectStatus;
  keywords?: string[];
  sortOrder?: number;
};

export type PublicDinnerSubjectsPayload = {
  past: DinnerSubject[];
  upcoming: DinnerSubject[];
};

function normalizeKeywords(keywords: string[] | undefined): string[] {
  if (!keywords?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keywords) {
    const k = raw.trim();
    if (!k || seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    out.push(k.slice(0, 80));
    if (out.length >= 24) break;
  }
  return out;
}

function resolveSubjectCity(city: string | undefined): string {
  const hub = resolveCityHub(city) ?? (city?.trim() || DEFAULT_CITY_HUB);
  if ((CITY_HUBS as readonly string[]).includes(hub)) return hub;
  return DEFAULT_CITY_HUB;
}

function mapLocaleMap(
  raw: unknown,
): Partial<Record<DinnerSubjectLocale, string>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Partial<Record<DinnerSubjectLocale, string>> = {};
  for (const key of ["fr", "en", "es"] as const) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

function mapDoc(id: string, data: Record<string, unknown>): DinnerSubject {
  const statusRaw = String(data.status ?? "published");
  const status: DinnerSubjectStatus =
    statusRaw === "draft" || statusRaw === "archived" || statusRaw === "published"
      ? statusRaw
      : "published";
  const keywordsRaw = data.keywords;
  const sourceRaw = String(data.sourceLocale ?? "fr");
  const sourceLocale: DinnerSubjectLocale =
    sourceRaw === "en" || sourceRaw === "es" || sourceRaw === "fr" ? sourceRaw : "fr";
  return {
    id,
    title: String(data.title ?? "").trim(),
    summary: data.summary != null ? String(data.summary).trim() : undefined,
    sourceLocale,
    titleI18n: mapLocaleMap(data.titleI18n),
    summaryI18n: mapLocaleMap(data.summaryI18n),
    periodMonth: String(data.periodMonth ?? "").trim(),
    city: resolveSubjectCity(data.city != null ? String(data.city) : undefined),
    status,
    keywords: normalizeKeywords(
      Array.isArray(keywordsRaw) ? keywordsRaw.map((k) => String(k)) : undefined,
    ),
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : undefined,
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
  };
}

function sortSubjects(a: DinnerSubject, b: DinnerSubject): number {
  const orderA = a.sortOrder ?? 1000;
  const orderB = b.sortOrder ?? 1000;
  if (orderA !== orderB) return orderA - orderB;
  if (a.periodMonth !== b.periodMonth) return a.periodMonth.localeCompare(b.periodMonth);
  return a.title.localeCompare(b.title, "fr");
}

export async function listDinnerSubjects(options?: {
  includeDrafts?: boolean;
  includeArchived?: boolean;
}): Promise<DinnerSubject[]> {
  if (!isFirebaseAdminConfigured()) return [];
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.dinnerSubjects).limit(200).get();
  const includeDrafts = options?.includeDrafts ?? false;
  const includeArchived = options?.includeArchived ?? false;
  return snap.docs
    .map((d) => mapDoc(d.id, d.data()))
    .filter((s) => {
      if (!s.title || !isValidPeriodMonth(s.periodMonth)) return false;
      if (s.status === "draft" && !includeDrafts) return false;
      if (s.status === "archived" && !includeArchived) return false;
      return true;
    })
    .sort(sortSubjects);
}

/** Seed defaults when catalog is empty (idempotent). */
export async function ensureDefaultDinnerSubjects(): Promise<DinnerSubject[]> {
  if (!isFirebaseAdminConfigured()) return [];
  const existing = await listDinnerSubjects({ includeDrafts: true, includeArchived: true });
  if (existing.length > 0) return existing;

  const db = getAdminFirestore();
  const now = new Date().toISOString();
  const seeds = buildDefaultDinnerSubjectSeeds();
  const batch = db.batch();
  const created: DinnerSubject[] = [];
  for (const seed of seeds) {
    const ref = db.collection(COLLECTIONS.dinnerSubjects).doc();
    const doc = {
      ...seed,
      city: resolveSubjectCity(seed.city),
      keywords: normalizeKeywords(seed.keywords),
      createdAt: now,
      updatedAt: now,
    };
    batch.set(ref, doc);
    created.push({ id: ref.id, ...doc });
  }
  await batch.commit();
  return created.sort(sortSubjects);
}

export async function listPublishedDinnerSubjectsGrouped(
  now = new Date(),
): Promise<PublicDinnerSubjectsPayload> {
  await ensureDefaultDinnerSubjects();
  const published = await listDinnerSubjects({ includeDrafts: false, includeArchived: false });
  const past: DinnerSubject[] = [];
  const upcoming: DinnerSubject[] = [];
  for (const subject of published) {
    const bucket: SubjectTimingBucket = subjectTimingBucket(subject.periodMonth, now);
    if (bucket === "past") past.push(subject);
    else upcoming.push(subject);
  }
  return { past, upcoming };
}

export async function getDinnerSubjectsByIds(ids: string[]): Promise<DinnerSubject[]> {
  if (!ids.length || !isFirebaseAdminConfigured()) return [];
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return [];
  await ensureDefaultDinnerSubjects();
  const all = await listDinnerSubjects({ includeDrafts: false, includeArchived: false });
  const byId = new Map(all.map((s) => [s.id, s]));
  return unique.flatMap((id) => {
    const s = byId.get(id);
    return s ? [s] : [];
  });
}

export async function createDinnerSubject(input: DinnerSubjectInput): Promise<DinnerSubject> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();
  const title = input.title.trim();
  const periodMonth = input.periodMonth.trim();
  if (!title || !isValidPeriodMonth(periodMonth)) {
    throw new Error("invalid_subject");
  }
  const summary = (input.summary ?? "").trim();
  const i18n = await buildSubjectI18nMaps({ title, summary, sourceLocale: "fr" });
  const doc = {
    title,
    summary,
    sourceLocale: i18n.sourceLocale,
    titleI18n: i18n.titleI18n,
    summaryI18n: i18n.summaryI18n,
    periodMonth,
    city: resolveSubjectCity(input.city),
    status: (input.status ?? "published") as DinnerSubjectStatus,
    keywords: normalizeKeywords(input.keywords),
    sortOrder: input.sortOrder ?? 100,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await db.collection(COLLECTIONS.dinnerSubjects).add(doc);
  return { id: ref.id, ...doc };
}

export async function updateDinnerSubject(
  id: string,
  input: Partial<DinnerSubjectInput>,
): Promise<DinnerSubject | null> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.dinnerSubjects).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const existing = mapDoc(snap.id, snap.data() ?? {});
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new Error("invalid_subject");
    patch.title = title;
  }
  if (input.summary !== undefined) patch.summary = input.summary.trim();
  if (input.periodMonth !== undefined) {
    const periodMonth = input.periodMonth.trim();
    if (!isValidPeriodMonth(periodMonth)) throw new Error("invalid_period");
    patch.periodMonth = periodMonth;
  }
  if (input.city !== undefined) patch.city = resolveSubjectCity(input.city);
  if (input.status !== undefined) patch.status = input.status;
  if (input.keywords !== undefined) patch.keywords = normalizeKeywords(input.keywords);
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

  const titleNext =
    input.title !== undefined ? input.title.trim() : existing.title;
  const summaryNext =
    input.summary !== undefined ? input.summary.trim() : (existing.summary ?? "");
  if (input.title !== undefined || input.summary !== undefined) {
    const i18n = await buildSubjectI18nMaps({
      title: titleNext,
      summary: summaryNext,
      sourceLocale: existing.sourceLocale ?? "fr",
      previous: existing,
    });
    patch.sourceLocale = i18n.sourceLocale;
    patch.titleI18n = i18n.titleI18n;
    patch.summaryI18n = i18n.summaryI18n;
  }

  await ref.set(patch, { merge: true });
  const next = await ref.get();
  return mapDoc(next.id, next.data() ?? {});
}

/** Persist missing locale strings for subjects (lazy backfill on public /themes). */
export async function backfillSubjectLocale(
  subjects: DinnerSubject[],
  locale: DinnerSubjectLocale,
): Promise<DinnerSubject[]> {
  if (!isFirebaseAdminConfigured()) return subjects;
  const db = getAdminFirestore();
  const out: DinnerSubject[] = [];
  for (const subject of subjects) {
    const source = subject.sourceLocale ?? "fr";
    if (locale === source) {
      out.push(subject);
      continue;
    }
    const needsTitle = !subject.titleI18n?.[locale]?.trim();
    const needsSummary = Boolean(subject.summary?.trim()) && !subject.summaryI18n?.[locale]?.trim();
    if (!needsTitle && !needsSummary) {
      out.push(subject);
      continue;
    }
    try {
      const i18n = await buildSubjectI18nMaps({
        title: subject.title,
        summary: subject.summary,
        sourceLocale: source,
        previous: subject,
      });
      await db.collection(COLLECTIONS.dinnerSubjects).doc(subject.id).set(
        {
          sourceLocale: i18n.sourceLocale,
          titleI18n: i18n.titleI18n,
          summaryI18n: i18n.summaryI18n,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      out.push({
        ...subject,
        sourceLocale: i18n.sourceLocale,
        titleI18n: i18n.titleI18n,
        summaryI18n: i18n.summaryI18n,
      });
    } catch (error) {
      console.warn("[dinner-subjects] backfill failed", subject.id, error);
      out.push(subject);
    }
  }
  return out;
}

export async function deleteDinnerSubject(id: string): Promise<boolean> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.dinnerSubjects).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}
