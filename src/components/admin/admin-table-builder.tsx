"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  setPendingInvitees,
  tableMembersToInviteEmails,
  tableMembersToPendingInvitees,
} from "@/lib/admin/pending-invitees";
import type { ComposedTableIdea, TableIdeaSeat } from "@/lib/admin/table-matching";
import type { TableIdeasErrorCode } from "@/lib/admin/table-matching";
import type { TableIdeaMode } from "@/lib/admin/table-matching/types";
import { labelPositionFr, labelSectorFr } from "@/lib/admin/waitlist-labels-fr";
import type { AdminEvent, TableDraft } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, CHIP, CHIP_ACTIVE, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { ArrowLeftRight, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type LoadState = "idle" | "loading" | "success" | "error";
type TableIdea = ComposedTableIdea;

const CITIES = ["Guadalajara", "Ciudad de México", "Monterrey", "Puebla"] as const;

const GENERATE_ERROR_LABELS_FR: Record<TableIdeasErrorCode | "generate_failed", string> = {
  validation: "Paramètres invalides. Vérifie la ville et le thème.",
  pool_too_small: "Pas assez de profils éligibles pour composer une table.",
  ai_not_configured: "IA absente — composition déterministe utilisée.",
  ai_invalid: "Réponse IA invalide. Réessaie.",
  fetch_failed: "Échec du chargement des données.",
  generate_failed: "Échec de la génération des idées.",
};

const ACTION_ERROR_LABELS_FR: Record<string, string> = {
  validation: "Données invalides. Vérifie les titulaires et réessaie.",
  save_failed: "Échec de l'enregistrement.",
  archive_failed: "Échec de l'archivage.",
  not_found: "Introuvable.",
  load_failed: "Échec du chargement.",
  fetch_failed: "Échec du chargement des données.",
  not_configured: "Service non configuré.",
  invalid_json: "Requête invalide.",
};

function describeGenerateError(code: string | undefined): string {
  if (code && code in GENERATE_ERROR_LABELS_FR) {
    return GENERATE_ERROR_LABELS_FR[code as keyof typeof GENERATE_ERROR_LABELS_FR];
  }
  return GENERATE_ERROR_LABELS_FR.generate_failed;
}

function describeActionError(code: string | undefined, fallback: string): string {
  if (code && code in ACTION_ERROR_LABELS_FR) {
    return ACTION_ERROR_LABELS_FR[code];
  }
  return fallback;
}

function describeDraftActionMessage(message: string): string {
  return describeActionError(message, message);
}

function memberSubtitle(member: TableIdeaSeat): string {
  return [labelPositionFr(member.position), labelSectorFr(member.sector), member.company.trim(), member.city.trim()]
    .filter((part) => Boolean(part) && part !== "—")
    .join(" · ");
}

function ideaFromDraft(draft: TableDraft): TableIdea {
  return {
    title: draft.title,
    themeAngle: draft.themeAngle,
    rationale: draft.rationale,
    commonalities: draft.commonalities,
    complementarities: draft.complementarities,
    warnings: draft.warnings,
    primary: draft.primary,
    alternates: draft.alternates,
  };
}

function formatDraftDate(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

const DRAFT_STATUS_LABELS_FR: Record<TableDraft["status"], string> = {
  draft: "Brouillon",
  used: "Utilisé",
  archived: "Archivé",
};

export function AdminTableBuilder() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const generateSectionRef = useRef<HTMLDivElement>(null);

  const [city, setCity] = useState("Guadalajara");
  const [mode, setMode] = useState<TableIdeaMode>("spontaneous");
  const [theme, setTheme] = useState("");

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [poolSize, setPoolSize] = useState<number | null>(null);
  const [ideas, setIdeas] = useState<TableIdea[]>([]);
  const [selectedIdeaIndex, setSelectedIdeaIndex] = useState(0);

  const [primary, setPrimary] = useState<TableIdeaSeat[]>([]);
  const [alternates, setAlternates] = useState<TableIdeaSeat[]>([]);

  const [drafts, setDrafts] = useState<TableDraft[]>([]);
  const [draftsLoadState, setDraftsLoadState] = useState<LoadState>("idle");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [humanValidatedAt, setHumanValidatedAt] = useState<string | null>(null);
  const [validatingDraft, setValidatingDraft] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  const [addToEventOpen, setAddToEventOpen] = useState(false);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [targetEventId, setTargetEventId] = useState("");
  const [adding, setAdding] = useState(false);
  const [addResultMsg, setAddResultMsg] = useState<string | null>(null);

  const selectedIdea = ideas[selectedIdeaIndex];

  const loadDrafts = useCallback(async () => {
    setDraftsLoadState("loading");
    try {
      const res = await authFetch("/api/admin/table-drafts");
      const json = (await res.json()) as { ok?: boolean; drafts?: TableDraft[]; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "load_failed");
      setDrafts(json.drafts ?? []);
      setDraftsLoadState("success");
    } catch {
      setDraftsLoadState("error");
    }
  }, [authFetch]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  // ?generate=1 only focuses the generation controls — it must never trigger an AI call.
  useEffect(() => {
    if (searchParams.get("generate") !== "1") return;
    generateSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const focusable = generateSectionRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button",
    );
    focusable?.focus();
  }, [searchParams]);

  function selectIdea(index: number) {
    const idea = ideas[index];
    if (!idea) return;
    setSelectedIdeaIndex(index);
    setActiveDraftId(null);
    setHumanValidatedAt(null);
    setDraftMessage(null);
    setPrimary(idea.primary);
    setAlternates(idea.alternates);
  }

  async function handleGenerate() {
    setLoadState("loading");
    setLoadError(null);
    try {
      const body =
        mode === "admin_theme" ? { city, mode, theme } : { city, mode };
      const res = await authFetch("/api/admin/table-ideas", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        ideas?: TableIdea[];
        poolSize?: number;
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "generate_failed");
      const nextIdeas = json.ideas ?? [];
      setIdeas(nextIdeas);
      setPoolSize(json.poolSize ?? null);
      setSelectedIdeaIndex(0);
      setActiveDraftId(null);
      setHumanValidatedAt(null);
      setDraftMessage(null);
      setPrimary(nextIdeas[0]?.primary ?? []);
      setAlternates(nextIdeas[0]?.alternates ?? []);
      setLoadState("success");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "generate_failed");
      setLoadState("error");
    }
  }

  function clearHumanValidation() {
    setHumanValidatedAt(null);
  }

  function removeFromPrimary(id: string) {
    setPrimary((prev) => prev.filter((m) => m.id !== id));
    clearHumanValidation();
  }

  function removeFromAlternates(id: string) {
    setAlternates((prev) => prev.filter((m) => m.id !== id));
    clearHumanValidation();
  }

  function swapRow(index: number) {
    if (index >= primary.length || index >= alternates.length) return;
    const nextPrimary = [...primary];
    const nextAlternates = [...alternates];
    const temp = nextPrimary[index];
    nextPrimary[index] = nextAlternates[index];
    nextAlternates[index] = temp;
    setPrimary(nextPrimary);
    setAlternates(nextAlternates);
    clearHumanValidation();
  }

  function ensureHumanValidationBeforeHandoff(): boolean {
    if (humanValidatedAt) return true;
    return window.confirm(
      "Cette table n’est pas encore marquée « validée humainement ».\n\nChecklist : conflits, équilibre, VIP, no-shows.\n\nContinuer quand même ?",
    );
  }

  async function markHumanValidated() {
    if (!activeDraftId) {
      setDraftMessage("Enregistre le brouillon avant de valider humainement.");
      return;
    }
    setValidatingDraft(true);
    setDraftMessage(null);
    const stamp = new Date().toISOString();
    try {
      const res = await authFetch(`/api/admin/table-drafts/${activeDraftId}`, {
        method: "PATCH",
        body: JSON.stringify({ humanValidatedAt: stamp }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
      setHumanValidatedAt(stamp);
      setDraftMessage("Table validée humainement.");
      await loadDrafts();
    } catch (e) {
      setDraftMessage(
        describeActionError(e instanceof Error ? e.message : undefined, "Échec de la validation."),
      );
    } finally {
      setValidatingDraft(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedIdea) return;
    setSavingDraft(true);
    setDraftMessage(null);
    const payload = {
      title: selectedIdea.title,
      city,
      themeAngle: selectedIdea.themeAngle,
      rationale: selectedIdea.rationale,
      commonalities: selectedIdea.commonalities,
      complementarities: selectedIdea.complementarities,
      warnings: selectedIdea.warnings,
      primary,
      alternates,
      humanValidatedAt: null as null,
    };
    try {
      if (activeDraftId) {
        const res = await authFetch(`/api/admin/table-drafts/${activeDraftId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
        setHumanValidatedAt(null);
        setDraftMessage("Brouillon mis à jour — revalide avant d’inviter.");
      } else {
        const res = await authFetch("/api/admin/table-drafts", {
          method: "POST",
          body: JSON.stringify({
            title: payload.title,
            city: payload.city,
            themeAngle: payload.themeAngle,
            rationale: payload.rationale,
            commonalities: payload.commonalities,
            complementarities: payload.complementarities,
            warnings: payload.warnings,
            primary: payload.primary,
            alternates: payload.alternates,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; id?: string; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
        setActiveDraftId(json.id ?? null);
        setHumanValidatedAt(null);
        setDraftMessage("Brouillon enregistré — valide humainement avant d’inviter.");
      }
      await loadDrafts();
    } catch (e) {
      setDraftMessage(describeActionError(e instanceof Error ? e.message : undefined, "Échec de l'enregistrement."));
    } finally {
      setSavingDraft(false);
    }
  }

  function openDraft(draft: TableDraft) {
    setActiveDraftId(draft.id);
    setHumanValidatedAt(draft.humanValidatedAt ?? null);
    setCity(
      draft.city ||
        [...draft.primary, ...draft.alternates].find((member) => member.city.trim())?.city ||
        "",
    );
    setIdeas([ideaFromDraft(draft)]);
    setSelectedIdeaIndex(0);
    setPrimary(draft.primary);
    setAlternates(draft.alternates);
    setDraftMessage(null);
  }

  async function archiveDraft(id: string) {
    try {
      const res = await authFetch(`/api/admin/table-drafts/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "archive_failed");
      if (activeDraftId === id) {
        setActiveDraftId(null);
        setHumanValidatedAt(null);
      }
      await loadDrafts();
    } catch (e) {
      setDraftMessage(describeActionError(e instanceof Error ? e.message : undefined, "Échec de l'archivage."));
    }
  }

  function createEventFromPrimary() {
    if (primary.length === 0) return;
    if (!ensureHumanValidationBeforeHandoff()) return;
    const invitees = tableMembersToPendingInvitees(primary);
    if (invitees.length === 0) {
      setDraftMessage("Aucun email valide parmi les titulaires.");
      return;
    }
    setPendingInvitees(invitees);
    router.push("/admin/evenements?nouveau=1");
  }

  async function openAddToEvent() {
    if (primary.length === 0) return;
    if (!ensureHumanValidationBeforeHandoff()) return;
    setAddToEventOpen(true);
    setAddResultMsg(null);
    setEventsLoading(true);
    try {
      const res = await authFetch("/api/admin/events");
      const json = (await res.json()) as { ok?: boolean; events?: AdminEvent[]; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "load_failed");
      setEvents(json.events ?? []);
      setTargetEventId(json.events?.[0]?.id ?? "");
    } catch (e) {
      setAddResultMsg(describeActionError(e instanceof Error ? e.message : undefined, "Échec du chargement."));
    } finally {
      setEventsLoading(false);
    }
  }

  async function confirmAddToEvent() {
    if (!targetEventId || primary.length === 0) return;
    const inviteEmails = tableMembersToInviteEmails(primary);
    if (inviteEmails.length === 0) {
      setAddResultMsg("Aucun email valide parmi les titulaires.");
      return;
    }
    setAdding(true);
    setAddResultMsg(null);
    try {
      const res = await authFetch(`/api/admin/events/${targetEventId}/invitees`, {
        method: "POST",
        body: JSON.stringify({ inviteEmails }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        added?: number;
        skipped?: number;
        waitlisted?: number;
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
      setAddResultMsg(
        `${json.added ?? 0} ajouté(s) · ${json.waitlisted ?? 0} en liste d'attente · ${json.skipped ?? 0} déjà présent(s).`,
      );
    } catch (e) {
      setAddResultMsg(describeActionError(e instanceof Error ? e.message : undefined, "Échec de l'enregistrement."));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-ns-hero">Constructeur de tables</h2>
        <p className="mt-1 text-sm text-ns-secondary">
          Génère des idées de tables à partir de la waitlist, ajuste les invités puis crée un
          événement ou complète-en un existant.
        </p>
      </div>

      <div ref={generateSectionRef} className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">Génération</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLASS} htmlFor="table-city">
              Ville
            </label>
            <input
              id="table-city"
              list="table-cities"
              className={INPUT_CLASS}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Guadalajara"
            />
            <datalist id="table-cities">
              {CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <span className={LABEL_CLASS} id="table-mode-label">
              Mode
            </span>
            <div
              className="mt-1 inline-flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1"
              role="radiogroup"
              aria-labelledby="table-mode-label"
            >
              <button
                type="button"
                role="radio"
                aria-checked={mode === "spontaneous"}
                className={mode === "spontaneous" ? CHIP_ACTIVE : CHIP}
                onClick={() => setMode("spontaneous")}
              >
                Spontané
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "admin_theme"}
                className={mode === "admin_theme" ? CHIP_ACTIVE : CHIP}
                onClick={() => setMode("admin_theme")}
              >
                Thème imposé
              </button>
            </div>
            <p className="mt-2 text-xs text-ns-secondary">
              {mode === "spontaneous"
                ? "Sans thème fixé : Analyser propose des tables à partir du vivier."
                : "Saisis un thème, puis clique Analyser."}
            </p>
          </div>
          {mode === "admin_theme" ? (
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS} htmlFor="table-theme">
                Thème
              </label>
              <textarea
                id="table-theme"
                className={INPUT_CLASS}
                rows={2}
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Ex. Fondateurs en phase de levée de fonds série A"
              />
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={loadState === "loading" || (mode === "admin_theme" && theme.trim().length < 3)}
            onClick={() => void handleGenerate()}
          >
            {loadState === "loading"
              ? "Analyse…"
              : mode === "spontaneous"
                ? "Analyser le vivier"
                : "Analyser ce thème"}
          </button>
          {poolSize !== null ? (
            <p className="text-xs text-ns-secondary">{poolSize} profil(s) éligible(s) dans le bassin.</p>
          ) : null}
        </div>
        {loadState === "error" ? (
          <p className={`mt-3 ${ERROR_TEXT}`}>{describeGenerateError(loadError ?? undefined)}</p>
        ) : null}
      </div>

      {ideas.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="rounded-2xl border border-gray-100 bg-ns-surface p-3">
            <h3 className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-ns-secondary">
              Idées ({ideas.length})
            </h3>
            <ul className="mt-1 space-y-1">
              {ideas.map((idea, index) => (
                <li key={`${idea.title}-${index}`}>
                  <button
                    type="button"
                    aria-current={index === selectedIdeaIndex ? "true" : undefined}
                    onClick={() => selectIdea(index)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                      index === selectedIdeaIndex
                        ? "bg-ns-brand-light text-ns-primary"
                        : "text-ns-tertiary hover:bg-ns-brand-light/60"
                    }`}
                  >
                    {idea.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selectedIdea ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
                <h3 className="text-lg font-bold text-ns-hero">{selectedIdea.title}</h3>
                <p className="mt-1 text-sm text-ns-secondary">{selectedIdea.themeAngle}</p>
                <p className="mt-3 text-sm text-ns-tertiary">{selectedIdea.rationale}</p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <IdeaTagList label="Points communs" items={selectedIdea.commonalities} tone="positive" />
                  <IdeaTagList
                    label="Complémentarités"
                    items={selectedIdea.complementarities}
                    tone="neutral"
                  />
                  <IdeaTagList label="Avertissements" items={selectedIdea.warnings} tone="warning" />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <MemberSeatList
                  title={`Titulaires (${primary.length})`}
                  members={primary}
                  onRemove={removeFromPrimary}
                  swapPartner={alternates}
                  onSwap={swapRow}
                />
                <MemberSeatList
                  title={`Remplaçants (${alternates.length})`}
                  members={alternates}
                  onRemove={removeFromAlternates}
                  swapPartner={primary}
                  onSwap={swapRow}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  disabled={savingDraft}
                  onClick={() => void handleSaveDraft()}
                >
                  {savingDraft ? "Enregistrement…" : "Enregistrer le brouillon"}
                </button>
                <button
                  type="button"
                  className={humanValidatedAt ? BTN_PRIMARY : BTN_SECONDARY}
                  disabled={validatingDraft || !activeDraftId}
                  onClick={() => void markHumanValidated()}
                  title={
                    activeDraftId
                      ? "Confirme la revue humaine (conflits, équilibre, VIP, no-shows)"
                      : "Enregistre d’abord le brouillon"
                  }
                >
                  {validatingDraft
                    ? "Validation…"
                    : humanValidatedAt
                      ? "Validée humainement ✓"
                      : "Valider humainement"}
                </button>
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  disabled={primary.length === 0}
                  onClick={createEventFromPrimary}
                >
                  Créer un événement
                </button>
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  disabled={primary.length === 0}
                  onClick={() => void openAddToEvent()}
                >
                  Ajouter à un événement existant
                </button>
                {draftMessage ? (
                  <p className="text-xs text-ns-secondary">{describeDraftActionMessage(draftMessage)}</p>
                ) : null}
              </div>
              <p className="text-xs text-ns-secondary">
                Avant d’inviter : enregistre → valide humainement (conflits, équilibre, VIP,
                no-shows) → crée / ajoute à un événement.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
          Brouillons enregistrés
        </h3>
        {draftMessage ? (
          <p className="mt-3 text-sm text-ns-secondary">{describeDraftActionMessage(draftMessage)}</p>
        ) : null}
        {draftsLoadState === "loading" ? (
          <p className="mt-3 text-sm text-ns-secondary">Chargement…</p>
        ) : draftsLoadState === "error" ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className={`text-sm ${ERROR_TEXT}`}>
              {describeActionError("load_failed", "Échec du chargement des brouillons.")}
            </p>
            <button type="button" className={`${BTN_SECONDARY} text-xs`} onClick={() => void loadDrafts()}>
              Réessayer
            </button>
          </div>
        ) : drafts.length === 0 ? (
          <p className="mt-3 text-sm text-ns-secondary">Aucun brouillon pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-50">
            {drafts.map((draft) => (
              <li key={draft.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ns-tertiary">{draft.title || "—"}</p>
                  <p className="text-xs text-ns-secondary">
                    {DRAFT_STATUS_LABELS_FR[draft.status]} · {formatDraftDate(draft.updatedAt)} ·{" "}
                    {draft.primary.length} titulaire(s)
                    {draft.humanValidatedAt ? " · Validée humainement" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className={`${BTN_SECONDARY} text-xs`} onClick={() => openDraft(draft)}>
                    Charger
                  </button>
                  {draft.status !== "archived" ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-ns-secondary hover:text-red-700"
                      onClick={() => void archiveDraft(draft.id)}
                    >
                      Archiver
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {addToEventOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="table-add-to-event-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h3 id="table-add-to-event-title" className="text-lg font-bold text-ns-hero">
              Ajouter à un événement
            </h3>
            <p className="mt-1 text-sm text-ns-secondary">
              {primary.length} titulaire(s) → liste des invités
            </p>
            {eventsLoading ? (
              <p className="mt-4 text-sm text-ns-secondary">Chargement des dîners…</p>
            ) : events.length === 0 ? (
              <p className="mt-4 text-sm text-ns-secondary">Aucun événement. Crée-en un d’abord.</p>
            ) : (
              <div className="mt-4">
                <label className={LABEL_CLASS} htmlFor="table-target-event">
                  Événement
                </label>
                <select
                  id="table-target-event"
                  value={targetEventId}
                  onChange={(e) => setTargetEventId(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {addResultMsg ? <p className="mt-3 text-sm text-ns-secondary">{addResultMsg}</p> : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={() => setAddToEventOpen(false)}>
                Fermer
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={adding || !targetEventId || events.length === 0}
                onClick={() => void confirmAddToEvent()}
              >
                {adding ? "Ajout…" : "Ajouter aux invités"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IdeaTagList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "positive" | "neutral" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "bg-amber-50 text-amber-900"
        : "bg-ns-brand-light text-ns-tertiary";
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">{label}</p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-xs text-ns-secondary">—</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {items.map((item, index) => (
            <li key={index} className={`rounded-full px-2.5 py-1 text-xs ${toneClass}`}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MemberSeatList({
  title,
  members,
  onRemove,
  swapPartner,
  onSwap,
}: {
  title: string;
  members: TableIdeaSeat[];
  onRemove: (id: string) => void;
  swapPartner: TableIdeaSeat[];
  onSwap: (index: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-ns-surface p-4">
      <h4 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">{title}</h4>
      {members.length === 0 ? (
        <p className="mt-3 text-sm text-ns-secondary">Aucun invité.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {members.map((member, index) => {
            const canSwap = Boolean(swapPartner[index]);
            return (
              <li
                key={member.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-gray-50 bg-white p-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ns-tertiary">{member.fullName}</p>
                  <p className="mt-0.5 truncate text-xs text-ns-secondary">{memberSubtitle(member)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {canSwap ? (
                    <button
                      type="button"
                      title="Échanger avec la ligne correspondante"
                      aria-label="Échanger"
                      className="rounded-full p-1.5 text-ns-secondary transition hover:bg-ns-brand-light hover:text-ns-primary"
                      onClick={() => onSwap(index)}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    title="Retirer"
                    aria-label="Retirer"
                    className="rounded-full p-1.5 text-ns-secondary transition hover:bg-red-50 hover:text-red-700"
                    onClick={() => onRemove(member.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
