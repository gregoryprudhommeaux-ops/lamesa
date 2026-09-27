"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  formatTableCurationNote,
  type TableCurationAction,
} from "@/lib/admin/ops-notes";
import {
  setPendingInvitees,
  tableMembersToInviteEmails,
  tableMembersToPendingInvitees,
} from "@/lib/admin/pending-invitees";
import type { ComposedTableIdea, TableIdeaSeat } from "@/lib/admin/table-matching";
import { ALTERNATE_SEATS, PRIMARY_SEATS } from "@/lib/admin/table-matching";
import type { TableIdeasErrorCode } from "@/lib/admin/table-matching";
import type { TableIdeaMode } from "@/lib/admin/table-matching/types";
import { tableThemeProspectListName } from "@/lib/admin/table-theme-prospect-list";
import { labelCityHubFr, labelPositionFr, labelSectorFr } from "@/lib/admin/waitlist-labels-fr";
import { TableIdeaProspectsPanel } from "@/components/admin/table-idea-prospects-panel";
import { CITY_HUBS, DEFAULT_CITY_HUB, resolveCityHub } from "@/lib/constants/city-hubs";
import {
  DEFAULT_EVENT_FORMAT,
  EVENT_FORMATS,
  labelEventFormat,
  type EventFormat,
} from "@/lib/constants/event-formats";
import type { AdminEvent, TableDraft } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, CHIP, CHIP_ACTIVE, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { ArrowLeftRight, History, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type LoadState = "idle" | "loading" | "success" | "error";
type TableIdea = ComposedTableIdea;
type SeatListKind = "primary" | "alternates";
type SeatActionMode = "move" | "remove";

type SeatActionTarget = {
  member: TableIdeaSeat;
  list: SeatListKind;
};

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
  return [labelPositionFr(member.position), labelSectorFr(member.sector), member.company.trim(), labelCityHubFr(member.city)]
    .filter((part) => Boolean(part) && part !== "—")
    .join(" · ");
}

function seatFromSnapshot(member: TableDraft["primary"][number]): TableIdeaSeat {
  return {
    id: member.id,
    fullName: member.fullName,
    email: member.email,
    company: member.company,
    sector: member.sector,
    position: member.position,
    city: member.city,
    invitationCount: member.invitationCount ?? 0,
    invitedToPreviousEvent: member.invitedToPreviousEvent ?? false,
    ...(member.themeFitBand ? { themeFitBand: member.themeFitBand } : {}),
  };
}

function ideaFromDraft(draft: TableDraft): TableIdea {
  return {
    title: draft.title,
    themeAngle: draft.themeAngle,
    rationale: draft.rationale,
    commonalities: draft.commonalities,
    complementarities: draft.complementarities,
    warnings: draft.warnings,
    primary: draft.primary.map(seatFromSnapshot),
    alternates: draft.alternates.map(seatFromSnapshot),
  };
}

function priorInviteLabel(member: TableIdeaSeat): { short: string; title: string } | null {
  if (member.invitedToPreviousEvent) {
    return {
      short: "Table préc.",
      title: "Invité à la table précédente — priorité réduite au scoring",
    };
  }
  if (member.invitationCount > 0) {
    return {
      short: member.invitationCount === 1 ? "Déjà invité" : `Invité ×${member.invitationCount}`,
      title: `Déjà invité ${member.invitationCount} fois — priorité réduite au scoring`,
    };
  }
  return null;
}

function themeFitLabel(member: TableIdeaSeat): { short: string; title: string; className: string } | null {
  if (!member.themeFitBand) return null;
  if (member.themeFitBand === "strong") {
    return {
      short: "Fit fort",
      title: "Alignement fort avec le thème de la table",
      className: "bg-emerald-50 text-emerald-900",
    };
  }
  if (member.themeFitBand === "medium") {
    return {
      short: "Fit moyen",
      title: "Alignement moyen avec le thème de la table",
      className: "bg-sky-50 text-sky-900",
    };
  }
  if (member.themeFitBand === "weak") {
    return {
      short: "Fit faible",
      title: "Alignement faible — à vérifier manuellement",
      className: "bg-amber-50 text-amber-900",
    };
  }
  return {
    short: "Hors thème",
    title: "Pas de signal thème — ne devrait pas être titulaire en mode qualité",
    className: "bg-rose-50 text-rose-900",
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

  const [city, setCity] = useState<string>(DEFAULT_CITY_HUB);
  const [format, setFormat] = useState<EventFormat>(DEFAULT_EVENT_FORMAT);
  const [mode, setMode] = useState<TableIdeaMode>("spontaneous");
  const [theme, setTheme] = useState("");

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [poolSize, setPoolSize] = useState<number | null>(null);
  const [ideas, setIdeas] = useState<TableIdea[]>([]);
  const [selectedIdeaIndex, setSelectedIdeaIndex] = useState(0);

  const [primary, setPrimary] = useState<TableIdeaSeat[]>([]);
  const [alternates, setAlternates] = useState<TableIdeaSeat[]>([]);
  const [prospectListName, setProspectListName] = useState<string | null>(null);

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
  const [contextEventTitle, setContextEventTitle] = useState<string | null>(null);

  const [seatAction, setSeatAction] = useState<SeatActionTarget | null>(null);
  const [seatActionMode, setSeatActionMode] = useState<SeatActionMode>("move");
  const [seatActionComment, setSeatActionComment] = useState("");
  const [seatActionBusy, setSeatActionBusy] = useState(false);
  const [seatActionError, setSeatActionError] = useState<string | null>(null);

  const selectedIdea = ideas[selectedIdeaIndex];
  const eventIdFromUrl = (searchParams.get("eventId") ?? "").trim();
  const dinerReturnHref = eventIdFromUrl
    ? `/admin/evenements?id=${encodeURIComponent(eventIdFromUrl)}&phase=dinner_prep`
    : null;

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

  // ?eventId= — keep dinner context when arriving from dinner_prep.
  useEffect(() => {
    if (!eventIdFromUrl) {
      setContextEventTitle(null);
      return;
    }
    setTargetEventId(eventIdFromUrl);
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch("/api/admin/events");
        const json = (await res.json()) as { ok?: boolean; events?: AdminEvent[]; error?: string };
        if (!res.ok || !json.ok || cancelled) return;
        const match = (json.events ?? []).find((e) => e.id === eventIdFromUrl);
        if (match) setContextEventTitle(match.title);
      } catch {
        // Banner still works with id alone.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, eventIdFromUrl]);

  function selectIdea(index: number) {
    const idea = ideas[index];
    if (!idea) return;
    setSelectedIdeaIndex(index);
    setActiveDraftId(null);
    setHumanValidatedAt(null);
    setDraftMessage(null);
    setPrimary(idea.primary);
    setAlternates(idea.alternates);
    setProspectListName(
      tableThemeProspectListName({
        theme: mode === "admin_theme" ? theme : undefined,
        title: idea.title,
        city,
      }),
    );
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
      setProspectListName(
        nextIdeas[0]
          ? tableThemeProspectListName({
              theme: mode === "admin_theme" ? theme : undefined,
              title: nextIdeas[0].title,
              city,
            })
          : null,
      );
      setLoadState("success");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "generate_failed");
      setLoadState("error");
    }
  }

  function clearHumanValidation() {
    setHumanValidatedAt(null);
  }

  function openSeatAction(member: TableIdeaSeat, list: SeatListKind) {
    setSeatAction({ member, list });
    setSeatActionMode(list === "primary" ? "move" : "remove");
    setSeatActionComment("");
    setSeatActionError(null);
  }

  function closeSeatAction() {
    if (seatActionBusy) return;
    setSeatAction(null);
    setSeatActionComment("");
    setSeatActionError(null);
  }

  function moveSeatToOtherList(member: TableIdeaSeat, from: SeatListKind): string | null {
    if (from === "primary") {
      if (alternates.some((seat) => seat.id === member.id)) {
        return "Ce profil est déjà en remplaçants.";
      }
      if (alternates.length >= ALTERNATE_SEATS) {
        return `Remplaçants complets (${ALTERNATE_SEATS}). Retire un remplacant d’abord.`;
      }
      setPrimary((prev) => prev.filter((seat) => seat.id !== member.id));
      setAlternates((prev) => [...prev, member]);
      clearHumanValidation();
      return null;
    }

    if (primary.some((seat) => seat.id === member.id)) {
      return "Ce profil est déjà en titulaires.";
    }
    if (primary.length >= PRIMARY_SEATS) {
      return `Titulaires complets (${PRIMARY_SEATS}). Retire un titulaire d’abord.`;
    }
    setAlternates((prev) => prev.filter((seat) => seat.id !== member.id));
    setPrimary((prev) => [...prev, member]);
    clearHumanValidation();
    return null;
  }

  async function persistCurationComment(
    member: TableIdeaSeat,
    list: SeatListKind,
    comment: string,
  ): Promise<string | null> {
    const action: TableCurationAction =
      list === "primary" ? "removed_from_primary" : "removed_from_alternate";
    const appendOpsNote = formatTableCurationNote({
      comment,
      action,
      themeTitle: selectedIdea?.title || theme || undefined,
    });
    const res = await authFetch(`/api/admin/waitlist/${encodeURIComponent(member.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appendOpsNote }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      return json.error ?? "save_failed";
    }
    return null;
  }

  async function confirmSeatAction() {
    if (!seatAction) return;
    setSeatActionError(null);

    if (seatActionMode === "move") {
      const moveError = moveSeatToOtherList(seatAction.member, seatAction.list);
      if (moveError) {
        setSeatActionError(moveError);
        return;
      }
      setSeatAction(null);
      setDraftMessage(
        seatAction.list === "primary"
          ? `${seatAction.member.fullName} déplacé en remplaçants.`
          : `${seatAction.member.fullName} déplacé en titulaires.`,
      );
      return;
    }

    const comment = seatActionComment.trim();
    if (comment.length < 8) {
      setSeatActionError("Ajoute un commentaire (min. 8 caractères) pour affiner le profil.");
      return;
    }

    setSeatActionBusy(true);
    try {
      const persistError = await persistCurationComment(
        seatAction.member,
        seatAction.list,
        comment,
      );
      if (persistError) {
        setSeatActionError(
          describeActionError(persistError, "Impossible d’enregistrer le commentaire profil."),
        );
        return;
      }
      if (seatAction.list === "primary") {
        setPrimary((prev) => prev.filter((seat) => seat.id !== seatAction.member.id));
      } else {
        setAlternates((prev) => prev.filter((seat) => seat.id !== seatAction.member.id));
      }
      clearHumanValidation();
      setDraftMessage(
        `Retiré · commentaire ajouté au profil de ${seatAction.member.fullName}.`,
      );
      setSeatAction(null);
      setSeatActionComment("");
    } catch (e) {
      setSeatActionError(e instanceof Error ? e.message : "save_failed");
    } finally {
      setSeatActionBusy(false);
    }
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
      format,
      themeAngle: selectedIdea.themeAngle,
      rationale: selectedIdea.rationale,
      commonalities: selectedIdea.commonalities,
      complementarities: selectedIdea.complementarities,
      warnings: selectedIdea.warnings,
      primary,
      alternates,
      ...(prospectListName?.trim()
        ? { prospectListName: prospectListName.trim().slice(0, 60) }
        : {}),
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
            format: payload.format,
            themeAngle: payload.themeAngle,
            rationale: payload.rationale,
            commonalities: payload.commonalities,
            complementarities: payload.complementarities,
            warnings: payload.warnings,
            primary: payload.primary,
            alternates: payload.alternates,
            ...(payload.prospectListName
              ? { prospectListName: payload.prospectListName }
              : {}),
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
      resolveCityHub(
        draft.city ||
          [...draft.primary, ...draft.alternates].find((member) => member.city.trim())?.city ||
          "",
      ) ?? DEFAULT_CITY_HUB,
    );
    setFormat(draft.format ?? DEFAULT_EVENT_FORMAT);
    setIdeas([ideaFromDraft(draft)]);
    setSelectedIdeaIndex(0);
    setPrimary(draft.primary.map(seatFromSnapshot));
    setAlternates(draft.alternates.map(seatFromSnapshot));
    setProspectListName(
      draft.prospectListName?.trim() ||
        tableThemeProspectListName({
          title: draft.title,
          theme: draft.themeAngle,
          city: draft.city,
        }),
    );
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
    setPendingInvitees(invitees, {
      format,
      city,
      title: selectedIdea?.title ?? "",
    });
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
      const preferred =
        (eventIdFromUrl && json.events?.some((e) => e.id === eventIdFromUrl)
          ? eventIdFromUrl
          : null) ||
        json.events?.[0]?.id ||
        "";
      setTargetEventId(preferred);
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
        <h2 className="text-xl font-bold text-ns-hero">Tables</h2>
        <p className="mt-1 text-sm text-ns-secondary">
          Génère des idées de tables à partir de la waitlist, ajuste les invités puis crée un
          événement ou complète-en un existant.
        </p>
      </div>

      {dinerReturnHref ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ns-primary/20 bg-ns-brand-light/50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
              Contexte dîner
            </p>
            <p className="truncate text-sm font-semibold text-ns-tertiary">
              {contextEventTitle || "Événement en cours"}
            </p>
          </div>
          <Link href={dinerReturnHref} className={`${BTN_SECONDARY} text-sm`}>
            ← Retour prépa dîner
          </Link>
        </div>
      ) : null}

      <div ref={generateSectionRef} className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">Génération</h3>

        <div className="mt-4 space-y-4">
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
            <div>
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

          <div className="flex flex-wrap items-center gap-3">
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
              <p className="text-xs text-ns-secondary">
                {poolSize} profil(s) éligible(s) · {city.trim() ? labelCityHubFr(city) : "—"}
              </p>
            ) : (
              <p className="text-xs text-ns-secondary">
                Vivier : {city.trim() ? labelCityHubFr(city) : "—"}
              </p>
            )}
          </div>
        </div>

        <details className="mt-4 border-t border-gray-100 pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-ns-secondary hover:text-ns-tertiary">
            Ville & format
          </summary>
          <div className="mt-2 grid max-w-md gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS} htmlFor="table-city">
                Ville
              </label>
              <select
                id="table-city"
                className={`${INPUT_CLASS} text-sm`}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                {CITY_HUBS.map((c) => (
                  <option key={c} value={c}>
                    {labelCityHubFr(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="table-format">
                Format
              </label>
              <select
                id="table-format"
                className={`${INPUT_CLASS} text-sm`}
                value={format}
                onChange={(e) => setFormat(e.target.value as EventFormat)}
              >
                {EVENT_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {labelEventFormat(f, "fr")}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-ns-secondary sm:col-span-2">
              Défaut : Guadalajara · Dîner — à changer seulement si tu analyses un autre hub ou format.
            </p>
          </div>
        </details>

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
                  list="primary"
                  onOpenSeat={(member) => openSeatAction(member, "primary")}
                  swapPartner={alternates}
                  onSwap={swapRow}
                />
                <MemberSeatList
                  title={`Remplaçants (${alternates.length})`}
                  members={alternates}
                  list="alternates"
                  onOpenSeat={(member) => openSeatAction(member, "alternates")}
                  swapPartner={primary}
                  onSwap={swapRow}
                />
              </div>

              <TableIdeaProspectsPanel
                theme={mode === "admin_theme" ? theme : undefined}
                title={selectedIdea.title}
                city={city}
                listName={prospectListName}
                onListNameChange={setProspectListName}
                seatedEmails={
                  new Set(
                    [...primary, ...alternates]
                      .map((seat) => seat.email.trim().toLowerCase())
                      .filter(Boolean),
                  )
                }
                onPromoteMember={(member) => {
                  if (
                    primary.some(
                      (seat) => seat.id === member.id || seat.email === member.email,
                    )
                  ) {
                    return;
                  }
                  if (primary.length >= PRIMARY_SEATS) {
                    setDraftMessage(`Titulaires complets (${PRIMARY_SEATS}).`);
                    return;
                  }
                  setAlternates((prev) =>
                    prev.filter(
                      (seat) => seat.id !== member.id && seat.email !== member.email,
                    ),
                  );
                  setPrimary((prev) => [
                    ...prev,
                    {
                      ...member,
                      invitationCount: 0,
                      invitedToPreviousEvent: false,
                    },
                  ]);
                  setDraftMessage(`${member.fullName} ajouté en titulaire.`);
                }}
              />

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
                    {DRAFT_STATUS_LABELS_FR[draft.status]} · {labelEventFormat(draft.format, "fr")} ·{" "}
                    {formatDraftDate(draft.updatedAt)} · {draft.primary.length} titulaire(s)
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

      {seatAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="table-seat-action-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h3 id="table-seat-action-title" className="text-lg font-bold text-ns-hero">
              {seatAction.member.fullName}
            </h3>
            <p className="mt-1 text-sm text-ns-secondary">{memberSubtitle(seatAction.member)}</p>
            <p className="mt-3 text-sm text-ns-tertiary">
              {seatAction.list === "primary"
                ? "Déplace en remplaçants, ou retire avec un commentaire pour affiner le prochain scan."
                : "Remonte en titulaires, ou retire avec un commentaire pour affiner le prochain scan."}
            </p>

            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">Action</legend>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-100 p-3 has-[:checked]:border-ns-primary has-[:checked]:bg-ns-brand-light">
                <input
                  type="radio"
                  name="seat-action-mode"
                  className="mt-1"
                  checked={seatActionMode === "move"}
                  onChange={() => {
                    setSeatActionMode("move");
                    setSeatActionError(null);
                  }}
                />
                <span>
                  <span className="block text-sm font-semibold text-ns-tertiary">
                    {seatAction.list === "primary" ? "Placer en remplaçants" : "Placer en titulaires"}
                  </span>
                  <span className="mt-0.5 block text-xs text-ns-secondary">
                    Garde le profil dans la composition sans toucher aux notes.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-100 p-3 has-[:checked]:border-ns-primary has-[:checked]:bg-ns-brand-light">
                <input
                  type="radio"
                  name="seat-action-mode"
                  className="mt-1"
                  checked={seatActionMode === "remove"}
                  onChange={() => {
                    setSeatActionMode("remove");
                    setSeatActionError(null);
                  }}
                />
                <span>
                  <span className="block text-sm font-semibold text-ns-tertiary">
                    Retirer de la sélection
                  </span>
                  <span className="mt-0.5 block text-xs text-ns-secondary">
                    Le commentaire enrichit le profil et oriente les prochains scans IA.
                  </span>
                </span>
              </label>
            </fieldset>

            {seatActionMode === "remove" ? (
              <div className="mt-4">
                <label className={LABEL_CLASS} htmlFor="table-seat-curation-comment">
                  Pourquoi retirer ce profil ?
                </label>
                <textarea
                  id="table-seat-curation-comment"
                  className={`${INPUT_CLASS} min-h-[96px]`}
                  value={seatActionComment}
                  onChange={(e) => setSeatActionComment(e.target.value)}
                  placeholder="Ex. trop junior pour PE/FO, doublon secteur, mauvais fit thème…"
                  maxLength={600}
                />
                <p className="mt-1 text-xs text-ns-secondary">
                  Enregistré dans les notes ops du membre (min. 8 caractères).
                </p>
              </div>
            ) : null}

            {seatActionError ? <p className={`mt-3 text-sm ${ERROR_TEXT}`}>{seatActionError}</p> : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={seatActionBusy}
                onClick={closeSeatAction}
              >
                Annuler
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={seatActionBusy}
                onClick={() => void confirmSeatAction()}
              >
                {seatActionBusy
                  ? "Enregistrement…"
                  : seatActionMode === "move"
                    ? "Déplacer"
                    : "Retirer + commenter"}
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
  list,
  onOpenSeat,
  swapPartner,
  onSwap,
}: {
  title: string;
  members: TableIdeaSeat[];
  list: SeatListKind;
  onOpenSeat: (member: TableIdeaSeat) => void;
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
            const priorInvite = priorInviteLabel(member);
            const themeFit = themeFitLabel(member);
            return (
              <li
                key={member.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-gray-50 bg-white p-2.5"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-md text-left transition hover:bg-ns-brand-light/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-primary"
                  onClick={() => onOpenSeat(member)}
                  title="Gérer ce siège"
                  aria-label={`Gérer ${member.fullName}`}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-ns-tertiary">{member.fullName}</p>
                    {themeFit ? (
                      <span
                        title={themeFit.title}
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${themeFit.className}`}
                      >
                        {themeFit.short}
                      </span>
                    ) : null}
                    {priorInvite ? (
                      <span
                        title={priorInvite.title}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900"
                      >
                        <History className="h-3 w-3" aria-hidden />
                        {priorInvite.short}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ns-secondary">{memberSubtitle(member)}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ns-secondary">
                    {list === "primary" ? "Cliquer · remplacant ou retirer" : "Cliquer · titulaire ou retirer"}
                  </p>
                </button>
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
                    title="Gérer / retirer"
                    aria-label={`Gérer ${member.fullName}`}
                    className="rounded-full p-1.5 text-ns-secondary transition hover:bg-red-50 hover:text-red-700"
                    onClick={() => onOpenSeat(member)}
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
