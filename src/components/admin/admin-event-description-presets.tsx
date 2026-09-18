"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import type { EventDescriptionPreset } from "@/lib/events/description-presets";
import { BTN_SECONDARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { useCallback, useEffect, useState } from "react";

type EventDescriptionPresetsBarProps = {
  introText: string;
  subtitle: string;
  menuIncluded: string;
  onApply: (preset: Pick<EventDescriptionPreset, "introText" | "subtitle" | "menuIncluded">) => void;
};

export function EventDescriptionPresetsBar({
  introText,
  subtitle,
  menuIncluded,
  onApply,
}: EventDescriptionPresetsBarProps) {
  const authFetch = useAuthFetch();
  const [presets, setPresets] = useState<EventDescriptionPreset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authFetch("/api/admin/event-description-presets");
      const json = (await res.json()) as {
        ok?: boolean;
        presets?: EventDescriptionPreset[];
      };
      if (res.ok && json.ok) setPresets(json.presets ?? []);
    } catch {
      // non-blocking
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePreset() {
    const name = window.prompt(
      "Nom du modèle de descriptif (réutilisable pour d’autres événements) :",
      subtitle.trim() || introText.trim().slice(0, 40) || "Descriptif LA MESA",
    );
    if (!name?.trim()) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch("/api/admin/event-description-presets", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          introText,
          subtitle,
          menuIncluded,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        preset?: EventDescriptionPreset;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.preset) throw new Error(json.error ?? "save_failed");
      setPresets((prev) => [json.preset!, ...prev]);
      setSelectedId(json.preset.id);
      setMessage(`Modèle « ${json.preset.name} » enregistré.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function applySelected() {
    const preset = presets.find((p) => p.id === selectedId);
    if (!preset) return;
    onApply({
      introText: preset.introText,
      subtitle: preset.subtitle,
      menuIncluded: preset.menuIncluded,
    });
    setMessage(`Modèle « ${preset.name} » chargé.`);
  }

  async function deleteSelected() {
    if (!selectedId) return;
    if (!window.confirm("Supprimer ce modèle de descriptif ?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/admin/event-description-presets?id=${encodeURIComponent(selectedId)}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "delete_failed");
      setPresets((prev) => prev.filter((p) => p.id !== selectedId));
      setSelectedId("");
      setMessage("Modèle supprimé.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-ns-alternate bg-white p-3">
      <p className={LABEL_CLASS}>Descriptif — modèles sauvegardés</p>
      <p className="mt-0.5 text-[11px] text-ns-secondary">
        Intro, sous-titre et menu : sauve un modèle pour le réutiliser sur un prochain dîner.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <label className="sr-only" htmlFor="desc-preset-select">
            Modèle
          </label>
          <select
            id="desc-preset-select"
            className={INPUT_CLASS}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Charger un modèle…</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={BTN_SECONDARY}
          disabled={!selectedId}
          onClick={applySelected}
        >
          Appliquer
        </button>
        <button
          type="button"
          className={BTN_SECONDARY}
          disabled={saving || !selectedId}
          onClick={() => void deleteSelected()}
        >
          Supprimer
        </button>
        <button
          type="button"
          className={BTN_SECONDARY}
          disabled={saving}
          onClick={() => void savePreset()}
        >
          {saving ? "…" : "Sauver le descriptif actuel"}
        </button>
      </div>
      {error ? <p className={`mt-2 ${ERROR_TEXT}`}>{error}</p> : null}
      {message ? <p className="mt-2 text-xs font-medium text-ns-primary">{message}</p> : null}
    </div>
  );
}
