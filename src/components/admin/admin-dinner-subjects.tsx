"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { CITY_HUBS, DEFAULT_CITY_HUB } from "@/lib/constants/city-hubs";
import { currentPeriodMonth, formatPeriodMonthLabel } from "@/lib/dinner-subjects/period";
import type { DinnerSubject, DinnerSubjectStatus } from "@/lib/types/events";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  ERROR_TEXT,
  INPUT_CLASS,
  LABEL_CLASS,
} from "@/lib/ui/nextstep";
import { useCallback, useEffect, useState } from "react";

const STATUS_LABELS: Record<DinnerSubjectStatus, string> = {
  published: "Publié",
  draft: "Brouillon",
  archived: "Archivé",
};

export function AdminDinnerSubjectsPanel() {
  const authFetch = useAuthFetch();
  const [subjects, setSubjects] = useState<DinnerSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [periodMonth, setPeriodMonth] = useState(currentPeriodMonth());
  const [city, setCity] = useState<string>(DEFAULT_CITY_HUB);
  const [status, setStatus] = useState<DinnerSubjectStatus>("published");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/dinner-subjects");
      const json = (await res.json()) as {
        ok?: boolean;
        subjects?: DinnerSubject[];
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "fetch_failed");
      setSubjects(json.subjects ?? []);
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
      setSubjects((prev) => [...prev, json.subject!].sort((a, b) =>
        a.periodMonth === b.periodMonth
          ? a.title.localeCompare(b.title, "fr")
          : a.periodMonth.localeCompare(b.periodMonth),
      ));
      setTitle("");
      setSummary("");
      setPeriodMonth(currentPeriodMonth());
      setStatus("published");
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
      setSubjects((prev) => prev.map((s) => (s.id === id ? json.subject! : s)));
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
      setSubjects((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete_failed");
    }
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ns-hero">Catalogue sujets de dîners</h2>
          <p className="text-xs text-ns-secondary">
            Période = mois (pas de date précise). Visible à l’inscription ; validation cohérence sur
            la fiche membre.
          </p>
        </div>
        <button type="button" className={BTN_SECONDARY} onClick={() => void load()} disabled={loading}>
          Rafraîchir
        </button>
      </div>

      <form onSubmit={(e) => void createSubject(e)} className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2 lg:col-span-2">
          <label className={LABEL_CLASS}>Titre</label>
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

      {error ? <p className={`${ERROR_TEXT} mb-2`}>{error}</p> : null}

      {loading ? (
        <p className="text-sm text-ns-secondary">Chargement…</p>
      ) : subjects.length === 0 ? (
        <p className="text-sm text-ns-secondary">Aucun sujet — le seed se crée au premier chargement.</p>
      ) : (
        <ul className="divide-y divide-black/5 border border-black/5 rounded-md">
          {subjects.map((subject) => (
            <li
              key={subject.id}
              className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ns-hero">{subject.title}</p>
                <p className="text-xs text-ns-secondary">
                  {formatPeriodMonthLabel(subject.periodMonth, "fr")} · {subject.city} ·{" "}
                  {STATUS_LABELS[subject.status]}
                </p>
                {subject.summary ? (
                  <p className="mt-0.5 text-xs text-ns-secondary">{subject.summary}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1">
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
          ))}
        </ul>
      )}
    </section>
  );
}
