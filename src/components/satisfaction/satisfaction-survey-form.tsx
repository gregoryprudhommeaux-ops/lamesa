"use client";

import { BTN_PRIMARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

const COMMENT_MAX = 1000;

const SCORES = [0, 1, 2, 3, 4, 5] as const;

type ScoreField =
  | "venueQuality"
  | "menuQuality"
  | "guestsQuality"
  | "wouldReturn"
  | "wouldRecommend";

const QUESTIONS: { key: ScoreField; label: string }[] = [
  { key: "venueQuality", label: "Calidad del lugar" },
  { key: "menuQuality", label: "Calidad del menú" },
  { key: "guestsQuality", label: "Calidad de los demás invitados" },
  { key: "wouldReturn", label: "¿Asistirías a una próxima cena?" },
  {
    key: "wouldRecommend",
    label: "¿Recomendarías el concepto LA MESA?",
  },
];

export function SatisfactionSurveyForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const isPreview =
    searchParams.get("preview") === "1" || searchParams.get("preview") === "true";

  const [scores, setScores] = useState<Record<ScoreField, number | null>>({
    venueQuality: null,
    menuQuality: null,
    guestsQuality: null,
    wouldReturn: null,
    wouldRecommend: null,
  });
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (isPreview) return Object.values(scores).every((v) => v !== null);
    if (!token) return false;
    return Object.values(scores).every((v) => v !== null);
  }, [token, scores, isPreview]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    if (isPreview) {
      setDone(true);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/satisfaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          venueQuality: scores.venueQuality,
          menuQuality: scores.menuQuality,
          guestsQuality: scores.guestsQuality,
          wouldReturn: scores.wouldReturn,
          wouldRecommend: scores.wouldRecommend,
          comment: comment.trim(),
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        alreadySubmitted?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "submit_failed");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token && !isPreview) {
    return (
      <p className={ERROR_TEXT}>
        Enlace no válido. Abre el cuestionario desde el correo de agradecimiento.
      </p>
    );
  }

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-bold text-ns-primary">
          {isPreview ? "Aperçu OK" : "Gracias"}
        </h1>
        <p className="text-sm text-ns-secondary">
          {isPreview
            ? "Mode aperçu — rien n’a été enregistré. Ferme cet onglet quand tu as validé le contenu."
            : "Gracias. Lo leemos antes de armar la siguiente mesa."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
      {isPreview ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-950">
          Aperçu admin — tu peux tout cliquer ; rien n’est envoyé en base.
        </div>
      ) : null}

      <div className="text-center">
        <h1 className="text-2xl font-bold text-ns-primary">¿Cómo estuvo el evento?</h1>
        <p className="mt-2 text-sm text-ns-secondary">
          Gracias por participar. Califica de 0 a 5 (5 = excelente).
        </p>
      </div>

      {QUESTIONS.map((q) => (
        <fieldset key={q.key} className="space-y-2">
          <legend className={LABEL_CLASS}>{q.label}</legend>
          <div className="flex flex-wrap gap-2">
            {SCORES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScores((prev) => ({ ...prev, [q.key]: n }))}
                className={`h-10 w-10 rounded-full text-sm font-semibold ${
                  scores[q.key] === n
                    ? "bg-[#b4e600] text-[#111]"
                    : "border border-ns-alternate bg-white text-ns-tertiary hover:bg-ns-brand-light"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      <div>
        <label className={LABEL_CLASS} htmlFor="satisfaction-comment">
          Todos los comentarios constructivos son bienvenidos
        </label>
        <textarea
          id="satisfaction-comment"
          className={`${INPUT_CLASS} mt-1 min-h-[88px] resize-y`}
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
          maxLength={COMMENT_MAX}
          placeholder="Opcional — cuéntanos qué mejorar o qué te gustó."
          rows={3}
        />
        <p className="mt-1 text-xs text-ns-secondary">
          {comment.length}/{COMMENT_MAX} · opcional
        </p>
      </div>

      {error && <p className={ERROR_TEXT}>{error}</p>}

      <button type="submit" className={`${BTN_PRIMARY} w-full`} disabled={!canSubmit || submitting}>
        {submitting ? "Enviando…" : isPreview ? "Valider l’aperçu" : "Enviar"}
      </button>
    </form>
  );
}
