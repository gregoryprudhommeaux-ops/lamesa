"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { CITY_HUBS, DEFAULT_CITY_HUB } from "@/lib/constants/city-hubs";
import type {
  PendingSubjectValidation,
  SubjectDemandRow,
} from "@/lib/dinner-subjects/demand";
import { currentPeriodMonth, formatPeriodMonthLabel } from "@/lib/dinner-subjects/period";
import type { DinnerSubject, DinnerSubjectStatus } from "@/lib/types/events";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  ERROR_TEXT,
  INPUT_CLASS,
  LABEL_CLASS,
} from "@/lib/ui/nextstep";
import { PRODUCTION_SITE_URL } from "@/lib/site-url";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_LABELS: Record<DinnerSubjectStatus, string> = {
  published: "Publié",
  draft: "Brouillon",
  archived: "Archivé",
};

function composeHref(subject: DinnerSubject): string {
  const params = new URLSearchParams({
    mode: "admin_theme",
    theme: subject.title,
    city: subject.city,
  });
  return `/admin/tables?${params.toString()}#table-generate`;
}

export function AdminDinnerSubjectsPanel() {
  const authFetch = useAuthFetch();
  const [subjects, setSubjects] = useState<DinnerSubject[]>([]);
  const [demand, setDemand] = useState<SubjectDemandRow[]>([]);
  const [pending, setPending] = useState<PendingSubjectValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [periodMonth, setPeriodMonth] = useState(currentPeriodMonth());
  const [city, setCity] = useState<string>(DEFAULT_CITY_HUB);
  const [status, setStatus] = useState<DinnerSubjectStatus>("published");

  const demandById = useMemo(() => {
    const map = new Map<string, SubjectDemandRow>();
    for (const row of demand) map.set(row.subject.id, row);
    return map;
  }, [demand]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subjectsRes, demandRes] = await Promise.all([
        authFetch("/api/admin/dinner-subjects"),
        authFetch("/api/admin/dinner-subjects/demand"),
      ]);
      const subjectsJson = (await subjectsRes.json()) as {
        ok?: boolean;
        subjects?: DinnerSubject[];
        error?: string;
      };
      const demandJson = (await demandRes.json()) as {
        ok?: boolean;
        demand?: SubjectDemandRow[];
        pendingValidations?: PendingSubjectValidation[];
        error?: string;
      };
      if (!subjectsRes.ok || !subjectsJson.ok) {
        throw new Error(subjectsJson.error ?? "fetch_failed");
      }
      if (!demandRes.ok || !demandJson.ok) {
        throw new Error(demandJson.error ?? "fetch_failed");
      }
      setSubjects(subjectsJson.subjects ?? []);
      setDemand(demandJson.demand ?? []);
      setPending(demandJson.pendingValidations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch_failed");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createSubject(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/dinner-subjects", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim(),
          periodMonth,
          city,
          status,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        subject?: DinnerSubject;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.subject) throw new Error(json.error ?? "save_failed");
      setTitle("");
      setSummary("");
      setPeriodMonth(currentPeriodMonth());
      setStatus("published");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  async function setSubjectStatus(id: string, next: DinnerSubjectStatus) {
    setError(null);
    try {
      const res = await authFetch(`/api/admin/dinner-subjects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        subject?: DinnerSubject;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.subject) throw new Error(json.error ?? "save_failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save_failed");
    }
  }

  async function removeSubject(id: string) {
    if (!window.confirm("Supprimer ce sujet du catalogue ?")) return;
    setError(null);
    try {
      const res = await authFetch(`/api/admin/dinner-subjects/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "delete_failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete_failed");
    }
  }

  const topDemand = demand
    .filter((row) => row.subject.status === "published" && row.counts.declared > 0)
    .slice(0, 8);

  return (
    <section className="space-y-4 rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ns-hero">Sujets de dîners — demande</h2>
          <p className="text-xs text-ns-secondary">
            Publier = visible sur la page publique (toutes villes). Membres avec profil 100 %
            choisissent → tu valides la cohérence → validés nourrissent le scan Tables.
          </p>
          <p className="mt-1 text-xs text-ns-secondary">
            Lien partageable :{" "}
            <a
              href={`${PRODUCTION_SITE_URL}/es/themes`}
              className="font-semibold text-ns-primary underline"
              target="_blank"
              rel="noreferrer"
            >
              {PRODUCTION_SITE_URL}/es/themes
            </a>
            {" · "}
            <button
              type="button"
              className="font-semibold text-ns-primary underline"
              onClick={() => {
                void navigator.clipboard.writeText(`${PRODUCTION_SITE_URL}/es/themes`);
              }}
            >
              Copier
            </button>
          </p>
        </div>
        <button type="button" className={BTN_SECONDARY} onClick={() => void load()} disabled={loading}>
          Rafraîchir
        </button>
      </div>

      {error ? <p className={ERROR_TEXT}>{error}</p> : null}

      {!loading && topDemand.length > 0 ? (
        <div className="rounded-md border border-ns-primary/20 bg-ns-primary/5 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ns-secondary">
            Demande observée
          </p>
          <ul className="space-y-2">
            {topDemand.map((row) => (
              <li
                key={row.subject.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-ns-hero">{row.subject.title}</span>
                  <span className="ml-2 text-xs text-ns-secondary">
                    {formatPeriodMonthLabel(row.subject.periodMonth, "fr")} · {row.subject.city} ·{" "}
                    {row.timing === "past" ? "passé" : "à venir"}
                  </span>
                  <p className="text-xs text-ns-secondary">
                    {row.counts.validated} validé(s) · {row.counts.pending} à valider ·{" "}
                    {row.counts.declared} déclaré(s)
                    {row.counts.rejected ? ` · ${row.counts.rejected} rejeté(s)` : ""}
                  </p>
                </div>
                <Link href={composeHref(row.subject)} className={BTN_PRIMARY}>
                  Composer table
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-900">
            Cohérence à valider ({pending.length})
          </p>
          <ul className="max-h-56 space-y-1.5 overflow-y-auto text-sm">
            {pending.slice(0, 40).map((row) => (
              <li
                key={`${row.memberId}-${row.subjectId}`}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-ns-hero">{row.fullName}</span>
                  <span className="text-ns-secondary"> → {row.subjectTitle}</span>
                  <p className="text-xs text-ns-secondary">
                    {[row.company, row.position, row.sector].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Link
                  href={`/admin/personnes?tab=membres&id=${encodeURIComponent(row.memberId)}`}
                  className={BTN_SECONDARY}
                >
                  Ouvrir fiche
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        onSubmit={(e) => void createSubject(e)}
        className="grid gap-3 border-t border-black/5 pt-3 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="sm:col-span-2 lg:col-span-2">
          <label className={LABEL_CLASS}>Nouveau sujet</label>
          <input
            className={`${INPUT_CLASS} mt-1`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            placeholder="ex. Scale SaaS B2B"
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Période (mois)</label>
          <input
            type="month"
            className={`${INPUT_CLASS} mt-1`}
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Ville</label>
          <select
            className={`${INPUT_CLASS} mt-1`}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            {CITY_HUBS.map((hub) => (
              <option key={hub} value={hub}>
                {hub}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Statut</label>
          <select
            className={`${INPUT_CLASS} mt-1`}
            value={status}
            onChange={(e) => setStatus(e.target.value as DinnerSubjectStatus)}
          >
            {(Object.keys(STATUS_LABELS) as DinnerSubjectStatus[]).map((key) => (
              <option key={key} value={key}>
                {STATUS_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className={`${BTN_PRIMARY} w-full`} disabled={saving}>
            {saving ? "…" : "Ajouter"}
          </button>
        </div>
        <div className="sm:col-span-2 lg:col-span-6">
          <label className={LABEL_CLASS}>Résumé (optionnel)</label>
          <input
            className={`${INPUT_CLASS} mt-1`}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={400}
            placeholder="Une ligne pour l’inscription"
          />
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-ns-secondary">Chargement…</p>
      ) : subjects.length === 0 ? (
        <p className="text-sm text-ns-secondary">Aucun sujet — le seed se crée au premier chargement.</p>
      ) : (
        <ul className="divide-y divide-black/5 rounded-md border border-black/5">
          {subjects.map((subject) => {
            const row = demandById.get(subject.id);
            return (
              <li
                key={subject.id}
                className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ns-hero">{subject.title}</p>
                  <p className="text-xs text-ns-secondary">
                    {formatPeriodMonthLabel(subject.periodMonth, "fr")} · {subject.city} ·{" "}
                    {STATUS_LABELS[subject.status]}
                    {row
                      ? ` · ${row.counts.validated} validé / ${row.counts.pending} pending / ${row.counts.declared} déclaré`
                      : ""}
                  </p>
                  {subject.summary ? (
                    <p className="mt-0.5 text-xs text-ns-secondary">{subject.summary}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  {subject.status === "published" ? (
                    <Link href={composeHref(subject)} className={BTN_PRIMARY}>
                      Composer
                    </Link>
                  ) : null}
                  {subject.status !== "published" ? (
                    <button
                      type="button"
                      className={BTN_SECONDARY}
                      onClick={() => void setSubjectStatus(subject.id, "published")}
                    >
                      Publier
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={BTN_SECONDARY}
                      onClick={() => void setSubjectStatus(subject.id, "archived")}
                    >
                      Archiver
                    </button>
                  )}
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    onClick={() => void removeSubject(subject.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
