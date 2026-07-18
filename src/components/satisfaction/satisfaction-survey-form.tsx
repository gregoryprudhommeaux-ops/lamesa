"use client";

import { LaMesaLogo } from "@/components/la-mesa-logo";
import { BTN_PRIMARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

const SCORES = [0, 1, 2, 3, 4, 5] as const;

type ScoreField = "venueQuality" | "menuQuality" | "guestsQuality" | "wouldReturn";

const QUESTIONS: { key: ScoreField; label: string }[] = [
  { key: "venueQuality", label: "Calidad del lugar" },
  { key: "menuQuality", label: "Calidad del menú" },
  { key: "guestsQuality", label: "Calidad de los demás invitados" },
  { key: "wouldReturn", label: "¿Asistirías a una próxima cena?" },
];

export function SatisfactionSurveyForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [scores, setScores] = useState<Record<ScoreField, number | null>>({
    venueQuality: null,
    menuQuality: null,
    guestsQuality: null,
    wouldReturn: null,
  });
  const [wantInviteOther, setWantInviteOther] = useState<"yes" | "no" | null>(null);
  const [invitedEmail, setInvitedEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!token) return false;
    if (Object.values(scores).some((v) => v === null)) return false;
    if (wantInviteOther === null) return false;
    if (wantInviteOther === "yes" && !invitedEmail.trim().includes("@")) return false;
    return true;
  }, [token, scores, wantInviteOther, invitedEmail]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
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
          wantInviteOther: wantInviteOther === "yes",
          invitedEmail: wantInviteOther === "yes" ? invitedEmail.trim() : "",
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        alreadySubmitted?: boolean;
        inviteSent?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "submit_failed");
      }
      setInviteSent(Boolean(json.inviteSent));
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <p className={ERROR_TEXT}>
        Enlace no válido. Abre el cuestionario desde el correo de agradecimiento.
      </p>
    );
  }

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-bold text-ns-primary">Gracias</h1>
        <p className="text-sm text-ns-secondary">
          Gracias. Lo leemos antes de armar la siguiente mesa.
        </p>
        {inviteSent && (
          <p className="text-sm text-ns-primary">
            Se envió una invitación de registro a LA MESA.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
      <div className="text-center">
        <LaMesaLogo size="sm" variant="horizontal" tone="black" className="mx-auto" />
        <h1 className="mt-3 text-2xl font-bold text-ns-primary">¿Cómo estuvo el evento?</h1>
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

      <fieldset className="space-y-2">
        <legend className={LABEL_CLASS}>¿Te gustaría invitar a otra persona?</legend>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              wantInviteOther === "yes" ? "bg-[#b4e600] text-[#111]" : "border border-ns-alternate"
            }`}
            onClick={() => setWantInviteOther("yes")}
          >
            Sí
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              wantInviteOther === "no" ? "bg-[#b4e600] text-[#111]" : "border border-ns-alternate"
            }`}
            onClick={() => setWantInviteOther("no")}
          >
            No
          </button>
        </div>
      </fieldset>

      {wantInviteOther === "yes" && (
        <div>
          <label className={LABEL_CLASS} htmlFor="invitedEmail">
            Correo electrónico de la persona a invitar
          </label>
          <input
            id="invitedEmail"
            type="email"
            className={INPUT_CLASS}
            value={invitedEmail}
            onChange={(e) => setInvitedEmail(e.target.value)}
            placeholder="nombre@empresa.com"
            required
          />
        </div>
      )}

      {error && <p className={ERROR_TEXT}>{error}</p>}

      <button type="submit" className={`${BTN_PRIMARY} w-full`} disabled={!canSubmit || submitting}>
        {submitting ? "Enviando…" : "Enviar"}
      </button>
    </form>
  );
}
