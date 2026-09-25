"use client";

import {
  SURVEY_COPY,
  SURVEY_SCORE_FIELDS,
  surveyLocaleFrom,
  type SurveyScoreField,
} from "@/lib/satisfaction/survey-copy";
import { BTN_PRIMARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

const COMMENT_MAX = 1000;
const SCORES = [0, 1, 2, 3, 4, 5] as const;

export function SatisfactionSurveyForm() {
  const searchParams = useSearchParams();
  const routeLocale = useLocale();
  const token = searchParams.get("token") ?? "";
  const isPreview =
    searchParams.get("preview") === "1" || searchParams.get("preview") === "true";
  const locale = surveyLocaleFrom(routeLocale);
  const copy = SURVEY_COPY[locale];

  const [scores, setScores] = useState<Record<SurveyScoreField, number | null>>({
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
    return <p className={ERROR_TEXT}>{copy.invalidLink}</p>;
  }

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-bold text-ns-primary">
          {isPreview ? copy.previewDoneTitle : copy.thanksTitle}
        </h1>
        <p className="text-sm text-ns-secondary">
          {isPreview ? copy.previewDoneBody : copy.thanksBody}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
      {isPreview ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-950">
          {copy.previewBanner}
        </div>
      ) : null}

      <div className="text-center">
        <h1 className="text-2xl font-bold text-ns-primary">{copy.title}</h1>
        <p className="mt-2 text-sm text-ns-secondary">{copy.intro}</p>
      </div>

      {SURVEY_SCORE_FIELDS.map((key) => (
        <fieldset key={key} className="space-y-2">
          <legend className={LABEL_CLASS}>{copy.questions[key]}</legend>
          <div className="flex flex-wrap gap-2">
            {SCORES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScores((prev) => ({ ...prev, [key]: n }))}
                className={`h-10 w-10 rounded-full text-sm font-semibold ${
                  scores[key] === n
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
          {copy.commentLabel}
        </label>
        <textarea
          id="satisfaction-comment"
          className={`${INPUT_CLASS} mt-1 min-h-[88px] resize-y`}
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
          maxLength={COMMENT_MAX}
          placeholder={copy.commentPlaceholder}
          rows={3}
        />
        <p className="mt-1 text-xs text-ns-secondary">
          {comment.length}/{COMMENT_MAX} · {copy.commentHint}
        </p>
      </div>

      {error && <p className={ERROR_TEXT}>{error}</p>}

      <button type="submit" className={`${BTN_PRIMARY} w-full`} disabled={!canSubmit || submitting}>
        {submitting ? copy.submitting : isPreview ? copy.previewSubmit : copy.submit}
      </button>
    </form>
  );
}
