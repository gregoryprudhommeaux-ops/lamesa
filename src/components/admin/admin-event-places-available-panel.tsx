"use client";

import { EventEmailTemplateEditor } from "@/components/admin/admin-event-email-template-editor";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import type { AdminEvent } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { useCallback, useEffect, useMemo, useState } from "react";

type Bucket = "eligible" | "french" | "sans_reponse" | "oui";

type Candidate = {
  email: string;
  fullName: string;
  company: string;
  buckets: Bucket[];
  onMesa: boolean;
  participationId: string | null;
  participationStatus: string | null;
  placesAvailableSentAt: string | null;
  prospectStatus: string | null;
};

type AdminEventPlacesAvailablePanelProps = {
  event: AdminEvent;
  onEventUpdated?: () => void;
};

const BUCKET_LABELS: Record<Bucket, string> = {
  eligible: "Tous éligibles",
  french: "Français (base)",
  sans_reponse: "Sans réponse",
  oui: "OUI / intéressés",
};

/**
 * Last-call “places still available” — filterable contact lists + manual multi-select send.
 */
export function AdminEventPlacesAvailablePanel({
  event,
  onEventUpdated,
}: AdminEventPlacesAvailablePanelProps) {
  const authFetch = useAuthFetch();
  const [bucket, setBucket] = useState<Bucket>("eligible");
  const [recipients, setRecipients] = useState<Candidate[]>([]);
  const [counts, setCounts] = useState<Record<Bucket, number>>({
    eligible: 0,
    french: 0,
    sans_reponse: 0,
    oui: 0,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publicAreaHint, setPublicAreaHint] = useState(
    event.publicAreaHint?.trim() || "Chapultepec, Guadalajara",
  );
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/admin/events/${event.id}/send-places-available?bucket=${bucket}`,
      );
      const json = (await res.json()) as {
        ok?: boolean;
        recipients?: Candidate[];
        counts?: Record<Bucket, number>;
        publicAreaHint?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "load_failed");
      const list = json.recipients ?? [];
      setRecipients(list);
      if (json.counts) setCounts(json.counts);
      if (json.publicAreaHint?.trim()) setPublicAreaHint(json.publicAreaHint.trim());
      setSelected(
        new Set(list.filter((r) => !r.placesAvailableSentAt).map((r) => r.email)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch, event.id, bucket]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const pending = recipients.filter((r) => !r.placesAvailableSentAt).length;
    const sent = recipients.filter((r) => Boolean(r.placesAvailableSentAt)).length;
    const notOnMesa = recipients.filter((r) => !r.onMesa).length;
    return { pending, sent, notOnMesa };
  }, [recipients]);

  function toggle(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function selectPending() {
    setSelected(new Set(recipients.filter((r) => !r.placesAvailableSentAt).map((r) => r.email)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function send() {
    const emails = [...selected];
    if (emails.length === 0) {
      setError("Sélectionne au moins un contact.");
      return;
    }
    if (!publicAreaHint.trim()) {
      setError("Indique le quartier public (sans resto ni adresse).");
      return;
    }
    if (
      !window.confirm(
        `Envoyer « places encore dispo » (+ ICS) à ${emails.length} personne(s) ?\nQuartier affiché : ${publicAreaHint.trim()}`,
      )
    ) {
      return;
    }
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/events/${event.id}/send-places-available`, {
        method: "POST",
        body: JSON.stringify({
          emails,
          publicAreaHint: publicAreaHint.trim(),
          resend: false,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        sent?: number;
        failed?: number;
        skipped?: number;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.detail || json.error || "send_failed");
      }
      setMessage(
        `Envoyé : ${json.sent ?? 0} · ignorés ${json.skipped ?? 0}` +
          (json.failed ? ` · échecs ${json.failed}` : ""),
      );
      await load();
      onEventUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div>
        <p className="text-sm font-bold text-ns-tertiary">Places encore disponibles</p>
        <p className="text-xs text-ns-secondary">
          Dernier appel : Français de la base + sans réponse + OUI non payés. Les NON (pas
          intéressés) et les payés sont exclus. Tu coches manuellement qui reçoit le mail.
          Quartier seulement (pas le resto). Un OUI (lien / réponse) déclenche l’envoi des
          coordonnées de paiement s’il reste de la place — sinon inscription /light d’abord.
        </p>
      </div>

      <EventEmailTemplateEditor
        event={event}
        templateKey="places_available"
        onEventUpdated={onEventUpdated}
        hint="Template « places encore dispo ». Réinit. cette langue si le corps est vide, puis sauve. Variables : wherePublic, registerUrl, prix, yesUrl/noUrl."
      />

      <div>
        <label className={LABEL_CLASS}>Quartier public (affiché dans le mail + ICS)</label>
        <input
          className={INPUT_CLASS}
          value={publicAreaHint}
          onChange={(e) => setPublicAreaHint(e.target.value)}
          placeholder="Chapultepec, Guadalajara"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(BUCKET_LABELS) as Bucket[]).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBucket(b)}
            className={
              bucket === b
                ? `${BTN_PRIMARY} text-xs`
                : `${BTN_SECONDARY} text-xs`
            }
          >
            {BUCKET_LABELS[b]} ({counts[b] ?? 0})
          </button>
        ))}
        <button type="button" onClick={() => void load()} className={`${BTN_SECONDARY} text-xs`}>
          Rafraîchir
        </button>
      </div>

      <p className="text-xs text-ns-secondary">
        Liste : {recipients.length} · à envoyer {stats.pending} · déjà envoyés {stats.sent} · hors
        Mesa {stats.notOnMesa} · sélection {selected.size}
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={selectPending} className={`${BTN_SECONDARY} text-xs`}>
          Tout (non envoyés)
        </button>
        <button type="button" onClick={clearSelection} className={`${BTN_SECONDARY} text-xs`}>
          Vider sélection
        </button>
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || selected.size === 0}
          className={`${BTN_PRIMARY} text-xs`}
        >
          {sending ? "Envoi…" : `Envoyer à ${selected.size}`}
        </button>
      </div>

      {error && <p className={ERROR_TEXT}>{error}</p>}
      {message && <p className="text-sm font-medium text-ns-primary">{message}</p>}

      {loading ? (
        <p className="text-sm text-ns-secondary">Chargement…</p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-ns-border bg-white p-2 text-sm">
          {recipients.map((r) => (
            <li key={r.email} className="flex items-start gap-2 py-1">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(r.email)}
                onChange={() => toggle(r.email)}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ns-tertiary truncate">
                  {r.fullName}{" "}
                  <span className="font-normal text-ns-secondary">· {r.email}</span>
                </p>
                <p className="text-xs text-ns-secondary">
                  {r.onMesa ? "Mesa" : "Hors Mesa"}
                  {r.company ? ` · ${r.company}` : ""}
                  {r.participationStatus ? ` · ${r.participationStatus}` : ""}
                  {r.placesAvailableSentAt ? " · déjà envoyé" : ""}
                </p>
              </div>
            </li>
          ))}
          {recipients.length === 0 && (
            <li className="text-ns-secondary px-1 py-2">Aucun contact dans ce filtre.</li>
          )}
        </ul>
      )}
    </div>
  );
}
