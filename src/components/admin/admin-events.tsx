"use client";

import { ContactPicker, type SelectedInvitee } from "@/components/admin/contact-picker";
import { FormalInviteOuiPanel } from "@/components/admin/admin-event-formal-invite-panel";
import { AdminEventPaymentFollowupPanel } from "@/components/admin/admin-event-payment-followup";
import { AdminEventPlacesAvailablePanel } from "@/components/admin/admin-event-places-available-panel";
import { AdminEventParticipantRoster } from "@/components/admin/admin-event-participant-roster";
import { EventDescriptionPresetsBar } from "@/components/admin/admin-event-description-presets";
import { EventTemplateDrawer } from "@/components/admin/event-template-drawer";
import {
  AutoRemindersPanel,
  StdRelancePanel,
} from "@/components/admin/admin-event-journey-panels";
import { EventPhaseSection } from "@/components/admin/admin-event-phase-section";
import {
  EventCommandHeader,
  EventCommandPhaseNav,
} from "@/components/admin/event-command-header";
import { AdminEventInterestInbox } from "@/components/admin/admin-event-interest-inbox";
import { AdminEventSatisfactionResults } from "@/components/admin/admin-event-satisfaction";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import {
  normalizeOpsPhaseId,
  opsPhasesForMode,
  type OpsPhaseId,
  type OpsPhaseMeta,
} from "@/lib/admin/ops-phases";
import { consumePendingEventSeed } from "@/lib/admin/pending-invitees";
import { suggestOpsPhase } from "@/lib/admin/suggest-ops-phase";
import { DRESS_CODES, PARKING_OPTIONS } from "@/lib/constants/form-options";
import {
  DEFAULT_EVENT_FORMAT,
  EVENT_FORMATS,
  defaultTimesForFormat,
  labelEventFormat,
  type EventFormat,
} from "@/lib/constants/event-formats";
import { CITY_HUBS, DEFAULT_CITY_HUB } from "@/lib/constants/city-hubs";
import { labelCityHubFr } from "@/lib/admin/waitlist-labels-fr";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  ERROR_TEXT,
  FORM_SECTION_TITLE,
  INPUT_CLASS,
  LABEL_CLASS,
} from "@/lib/ui/nextstep";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import {
  buildEmailTemplate,
  buildWhatsappInviteMessage,
  buildWhatsappTemplate,
  eventPublicUrl,
  fmtDateTime,
  toWhatsAppDigits,
  whatsappShareUrl,
} from "@/lib/events/utils";
import { applyInviteTemplateVars } from "@/lib/email/build-event-invite-template";
import {
  DEFAULT_TOTAL_COVERS,
  guestCapacityFromTotalCovers,
  totalCoversFromGuestCapacity,
} from "@/lib/events/capacity";
import { computeEventIva, formatMxn } from "@/lib/events/pricing";
import { resolveEventPricingMode, type EventPricingMode } from "@/lib/events/pricing-mode";
import { Copy, Mail, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type AdminEventsProps = {
  labels: Record<string, string>;
  locale: "fr" | "en" | "es";
  publicBaseUrl: string;
};

function toIsoFromLocalInput(value: string): string {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

/** Open native date/time picker when clicking anywhere on the field (not only the icon). */
function openNativePicker(e: { currentTarget: HTMLInputElement }) {
  const el = e.currentTarget;
  try {
    if (typeof el.showPicker === "function") {
      el.showPicker();
    }
  } catch {
    // Unsupported or blocked by browser — user can still type.
  }
}

function toLocalInputFromIso(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function splitLocal(iso?: string | null): { date: string; time: string } {
  const local = toLocalInputFromIso(iso);
  if (!local.includes("T")) return { date: "", time: "" };
  const [date, time] = local.split("T");
  return { date, time };
}

function combineLocal(date: string, time: string): string {
  if (!date) return "";
  return toIsoFromLocalInput(`${date}T${time || "19:00"}`);
}

type DressCode = AdminEvent["dressCode"];
type Parking = AdminEvent["parking"];

export function AdminEventsPanel({ labels, locale, publicBaseUrl }: AdminEventsProps) {
  const authFetch = useAuthFetch();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [participations, setParticipations] = useState<AdminEventParticipation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [organizerName, setOrganizerName] = useState("LA MESA");
  const [shareEnabled, setShareEnabled] = useState(false);
  const [introText, setIntroText] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("19:30");
  const [endTime, setEndTime] = useState("22:30");
  const [capacity, setCapacity] = useState(DEFAULT_TOTAL_COVERS);
  const [priceMxn, setPriceMxn] = useState<string>("450");
  const [pricingMode, setPricingMode] = useState<EventPricingMode>("ticket_onsite");
  const [accessIncludesWelcomeDrink, setAccessIncludesWelcomeDrink] = useState(true);
  const [accessIncludesAmuseBouche, setAccessIncludesAmuseBouche] = useState(false);
  const [menuIncluded, setMenuIncluded] = useState("");
  const [menuPriceMinMxn, setMenuPriceMinMxn] = useState("");
  const [menuPriceMaxMxn, setMenuPriceMaxMxn] = useState("");
  const [menuIncludesDrinks, setMenuIncludesDrinks] = useState<"unspecified" | "yes" | "no">(
    "unspecified",
  );
  const [format, setFormat] = useState<EventFormat>(DEFAULT_EVENT_FORMAT);
  const [city, setCity] = useState<string>(DEFAULT_CITY_HUB);
  const [dressCode, setDressCode] = useState<DressCode>("none_specified");
  const [parking, setParking] = useState<Parking>("unknown");
  const [registrationFormUrl, setRegistrationFormUrl] = useState("");
  const [flyerUrl, setFlyerUrl] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "closed">("draft");
  const [eventLanguage, setEventLanguage] = useState<"fr" | "en" | "es">("es");
  const [responseMode, setResponseMode] = useState<"rsvp" | "interest">("rsvp");
  const [subtitle, setSubtitle] = useState("");
  const [interestDeadlineAt, setInterestDeadlineAt] = useState("");
  const [paymentDeadlineAt, setPaymentDeadlineAt] = useState("");
  const [allInPriceMinMxn, setAllInPriceMinMxn] = useState("");
  const [allInPriceMaxMxn, setAllInPriceMaxMxn] = useState("");
  const [mesaNumber, setMesaNumber] = useState("");
  const [selectedInvitees, setSelectedInvitees] = useState<SelectedInvitee[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [sendingSaveTheDate, setSendingSaveTheDate] = useState(false);
  const [inviteSendResult, setInviteSendResult] = useState<string | null>(null);
  const [inviteSendOk, setInviteSendOk] = useState(false);
  /** Command-center focus: only one phase open in the work zone. */
  const [focusPhase, setFocusPhase] = useState<OpsPhaseId>("prep");
  /** When set, user overrode the suggested phase — show “revenir à la suggestion”. */
  const [phaseOverride, setPhaseOverride] = useState(false);

  const isInterestMode = responseMode === "interest";

  const journeyPhases: OpsPhaseMeta[] = useMemo(
    () => opsPhasesForMode(isInterestMode),
    [isInterestMode],
  );

  function phaseMeta(id: OpsPhaseId): OpsPhaseMeta {
    return (
      journeyPhases.find((p) => p.id === id) ??
      opsPhasesForMode(true).find((p) => p.id === id)!
    );
  }

  const activeEvent = useMemo(
    () => events.find((e) => e.id === activeId) ?? null,
    [events, activeId],
  );

  const activeParticipations = useMemo(
    () => participations.filter((p) => p.eventId === activeId),
    [participations, activeId],
  );

  const opsSuggestion = useMemo(() => {
    const eventForSuggest = activeEvent ?? {
      title,
      startsAt: combineLocal(eventDate, startTime) || new Date().toISOString(),
      venueName,
      address,
      status,
      responseMode,
      saveTheDateSentAt: undefined,
      capacity: guestCapacityFromTotalCovers(capacity),
    };
    return suggestOpsPhase({
      event: {
        ...eventForSuggest,
        title: title.trim() || eventForSuggest.title,
        venueName,
        address,
        status,
        responseMode,
        capacity: guestCapacityFromTotalCovers(capacity),
        saveTheDateSentAt: activeEvent?.saveTheDateSentAt,
      },
      draft: { title, eventDate, venueName, address },
      participations: activeParticipations,
    });
  }, [
    activeEvent,
    activeParticipations,
    title,
    eventDate,
    startTime,
    venueName,
    address,
    status,
    responseMode,
    capacity,
  ]);

  function syncUrl(eventId: string | null, phase: OpsPhaseId) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (eventId) url.searchParams.set("id", eventId);
    else url.searchParams.delete("id");
    url.searchParams.set("phase", phase);
    url.searchParams.delete("nouveau");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function focusOnPhase(id: OpsPhaseId, opts?: { fromSuggestion?: boolean }) {
    const normalized = normalizeOpsPhaseId(id, { interestMode: isInterestMode });
    setFocusPhase(normalized);
    if (opts?.fromSuggestion) setPhaseOverride(false);
    else setPhaseOverride(true);
    syncUrl(activeId, normalized);
    requestAnimationFrame(() => {
      document.getElementById("event-command-workzone")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function jumpToPhase(id: OpsPhaseId) {
    focusOnPhase(id);
  }

  function applySuggestedPhase() {
    focusOnPhase(opsSuggestion.phaseId, { fromSuggestion: true });
  }

  // If mode flips (interest ↔ rsvp), drop focus on phases that no longer exist.
  useEffect(() => {
    if (!journeyPhases.some((p) => p.id === focusPhase)) {
      setFocusPhase(opsSuggestion.phaseId);
      setPhaseOverride(false);
      syncUrl(activeId, opsSuggestion.phaseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when mode/phases change
  }, [isInterestMode, journeyPhases]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/events");
      const json = (await res.json()) as {
        ok?: boolean;
        events?: AdminEvent[];
        participations?: AdminEventParticipation[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Chargement impossible");
        return;
      }
      setEvents(
        (json.events ?? []).map((e) => ({
          ...e,
          startsAt: String(e.startsAt ?? new Date().toISOString()),
        })),
      );
      setParticipations(json.participations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /** Open event from ?id= (calendar / command-center deep-link) once list is loaded. */
  useEffect(() => {
    if (loading || events.length === 0) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const phaseParam = params.get("phase");
    if (!id) return;
    const event = events.find((e) => e.id === id);
    if (!event) return;
    if (activeId !== id) {
      openEdit(event, { preserveUrl: true, phaseFromUrl: phaseParam });
      return;
    }
    if (phaseParam) {
      const normalized = normalizeOpsPhaseId(phaseParam, {
        interestMode: event.responseMode === "interest",
      });
      setFocusPhase(normalized);
      setPhaseOverride(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when events arrive
  }, [loading, events]);

  function resetForm(
    invitees: SelectedInvitee[] = [],
    presetDate?: string,
    seed?: { format?: EventFormat; city?: string; title?: string },
  ) {
    const now = splitLocal(new Date().toISOString());
    const date =
      presetDate && /^\d{4}-\d{2}-\d{2}$/.test(presetDate) ? presetDate : now.date;
    const nextFormat = seed?.format ?? DEFAULT_EVENT_FORMAT;
    const times = defaultTimesForFormat(nextFormat);
    setActiveId(null);
    setTitle(seed?.title?.trim() ?? "");
    setOrganizerName("LA MESA");
    setShareEnabled(false);
    setIntroText("");
    setVenueName("");
    setAddress("");
    setMapsUrl("");
    setEventDate(date);
    setStartTime(times.startTime);
    setEndTime(times.endTime);
    setCapacity(Math.max(DEFAULT_TOTAL_COVERS, (invitees.length || 0) + 1));
    setPriceMxn("450");
    setPricingMode("ticket_onsite");
    setAccessIncludesWelcomeDrink(true);
    setAccessIncludesAmuseBouche(false);
    setMenuIncluded("");
    setMenuPriceMinMxn("");
    setMenuPriceMaxMxn("");
    setMenuIncludesDrinks("unspecified");
    setFormat(nextFormat);
    setCity(seed?.city?.trim() || DEFAULT_CITY_HUB);
    setDressCode("none_specified");
    setParking("unknown");
    setRegistrationFormUrl("");
    setFlyerUrl("");
    setStatus("draft");
    setEventLanguage("es");
    setResponseMode("rsvp");
    setSubtitle("");
    setInterestDeadlineAt("");
    setPaymentDeadlineAt("");
    setAllInPriceMinMxn("");
    setAllInPriceMaxMxn("");
    setMesaNumber("");
    setSelectedInvitees(invitees);
  }

  useEffect(() => {
    const pending = consumePendingEventSeed();
    const params =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const wantsNew = params?.get("nouveau") === "1";
    const dateParam = params?.get("date")?.trim() ?? "";
    if (pending.invitees.length === 0 && !wantsNew) return;
    resetForm(
      pending.invitees.map((p) => ({
        ...p,
        inviteAs: "invited" as const,
      })),
      dateParam || undefined,
      {
        format: pending.format,
        city: pending.city,
        title: pending.title,
      },
    );
    if (wantsNew && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("nouveau");
      url.searchParams.delete("date");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
    // seed once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    resetForm([]);
    setFocusPhase("prep");
    setPhaseOverride(false);
    syncUrl(null, "prep");
  }

  function openEdit(
    event: AdminEvent,
    opts?: { preserveUrl?: boolean; phaseFromUrl?: string | null },
  ) {
    const start = splitLocal(event.startsAt);
    const end = splitLocal(event.endsAt);
    setActiveId(event.id);
    setTitle(event.title);
    setOrganizerName(event.organizerName ?? "LA MESA");
    setShareEnabled(Boolean(event.shareEnabled));
    setIntroText(event.introText ?? "");
    setVenueName(event.venueName ?? "");
    setAddress(event.address ?? "");
    setMapsUrl(event.mapsUrl ?? "");
    setEventDate(start.date);
    setStartTime(start.time || "19:30");
    setEndTime(end.time || "");
    setCapacity(totalCoversFromGuestCapacity(event.capacity));
    setPriceMxn(
      event.priceMxn != null && Number.isFinite(event.priceMxn) ? String(event.priceMxn) : "",
    );
    setPricingMode(resolveEventPricingMode(event));
    setAccessIncludesWelcomeDrink(Boolean(event.accessIncludesWelcomeDrink));
    setAccessIncludesAmuseBouche(Boolean(event.accessIncludesAmuseBouche));
    setMenuIncluded(event.menuIncluded ?? "");
    setMenuPriceMinMxn(
      event.menuPriceMinMxn != null && Number.isFinite(event.menuPriceMinMxn)
        ? String(event.menuPriceMinMxn)
        : "",
    );
    setMenuPriceMaxMxn(
      event.menuPriceMaxMxn != null && Number.isFinite(event.menuPriceMaxMxn)
        ? String(event.menuPriceMaxMxn)
        : "",
    );
    setMenuIncludesDrinks(
      event.menuIncludesDrinks === true
        ? "yes"
        : event.menuIncludesDrinks === false
          ? "no"
          : "unspecified",
    );
    setFormat((event.format as EventFormat | undefined) ?? DEFAULT_EVENT_FORMAT);
    setCity(event.city?.trim() || DEFAULT_CITY_HUB);
    setDressCode(event.dressCode ?? "none_specified");
    setParking(event.parking ?? "unknown");
    setRegistrationFormUrl(event.registrationFormUrl ?? "");
    setFlyerUrl(event.flyerUrl ?? "");
    setStatus(event.status ?? "draft");
    setEventLanguage(event.eventLanguage ?? "es");
    setResponseMode(event.responseMode === "interest" ? "interest" : "rsvp");
    setSubtitle(event.subtitle ?? "");
    setInterestDeadlineAt(toLocalInputFromIso(event.interestDeadlineAt));
    setPaymentDeadlineAt(toLocalInputFromIso(event.paymentDeadlineAt));
    setAllInPriceMinMxn(
      event.allInPriceMinMxn != null && Number.isFinite(event.allInPriceMinMxn)
        ? String(event.allInPriceMinMxn)
        : "",
    );
    setAllInPriceMaxMxn(
      event.allInPriceMaxMxn != null && Number.isFinite(event.allInPriceMaxMxn)
        ? String(event.allInPriceMaxMxn)
        : "",
    );
    setMesaNumber(
      event.mesaNumber != null && Number.isFinite(event.mesaNumber)
        ? String(event.mesaNumber)
        : "",
    );
    setSelectedInvitees([]);

    const parts = participations.filter((p) => p.eventId === event.id);
    const suggested = suggestOpsPhase({
      event,
      draft: {
        title: event.title,
        eventDate: start.date,
        venueName: event.venueName ?? "",
        address: event.address ?? "",
      },
      participations: parts,
    });
    const interest = event.responseMode === "interest";
    const urlPhase = opts?.phaseFromUrl
      ? normalizeOpsPhaseId(opts.phaseFromUrl, { interestMode: interest })
      : null;
    const nextPhase = opts?.phaseFromUrl && urlPhase ? urlPhase : suggested.phaseId;
    setFocusPhase(nextPhase);
    setPhaseOverride(Boolean(opts?.phaseFromUrl));
    syncUrl(event.id, nextPhase);
  }

  function eventPayload() {
    const startsAtIso = combineLocal(eventDate, startTime);
    const endsAtIso = endTime ? combineLocal(eventDate, endTime) : null;
    return {
      title: title.trim(),
      organizerName: organizerName.trim(),
      introText: introText.trim(),
      venueName: venueName.trim(),
      address: address.trim(),
      mapsUrl: mapsUrl.trim(),
      registrationFormUrl: registrationFormUrl.trim(),
      flyerUrl: flyerUrl.trim(),
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      capacity: guestCapacityFromTotalCovers(capacity),
      priceMxn: priceMxn.trim() === "" ? null : Number(priceMxn),
      pricingMode,
      accessIncludesWelcomeDrink,
      accessIncludesAmuseBouche,
      menuIncluded: menuIncluded.trim(),
      menuPriceMinMxn: menuPriceMinMxn.trim() === "" ? null : Number(menuPriceMinMxn),
      menuPriceMaxMxn: menuPriceMaxMxn.trim() === "" ? null : Number(menuPriceMaxMxn),
      menuIncludesDrinks:
        menuIncludesDrinks === "yes" ? true : menuIncludesDrinks === "no" ? false : null,
      format,
      city,
      status,
      eventLanguage,
      dressCode,
      parking,
      shareEnabled,
      responseMode,
      subtitle: subtitle.trim(),
      interestDeadlineAt: interestDeadlineAt.trim()
        ? toIsoFromLocalInput(interestDeadlineAt.trim())
        : null,
      paymentDeadlineAt: paymentDeadlineAt.trim()
        ? toIsoFromLocalInput(paymentDeadlineAt.trim())
        : null,
      allInPriceMinMxn: allInPriceMinMxn.trim() === "" ? null : Number(allInPriceMinMxn),
      allInPriceMaxMxn: allInPriceMaxMxn.trim() === "" ? null : Number(allInPriceMaxMxn),
      mesaNumber: mesaNumber.trim() === "" ? null : Number(mesaNumber),
    };
  }

  async function saveEvent(phaseLabel?: string) {
    if (!title.trim() || !eventDate || !startTime) {
      setSaveOk(null);
      setError("Titre, date et heure de début sont obligatoires (phase Préparation).");
      jumpToPhase("prep");
      return;
    }
    setSaving(true);
    setError(null);
    setSaveOk(null);
    try {
      const payload = eventPayload();
      if (activeId) {
        const res = await authFetch(`/api/admin/events/${activeId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
        if (selectedInvitees.length > 0) {
          const invRes = await authFetch(`/api/admin/events/${activeId}/invitees`, {
            method: "POST",
            body: JSON.stringify({
              inviteEmails: selectedInvitees.map((inv) => ({
                email: inv.email,
                fullName: inv.fullName,
                companyName: inv.companyName,
                contactId: inv.contactId,
                status: inv.inviteAs,
              })),
            }),
          });
          const invJson = (await invRes.json()) as { ok?: boolean; error?: string };
          if (!invRes.ok || !invJson.ok) throw new Error(invJson.error ?? "invitees_failed");
          setSelectedInvitees([]);
        }
      } else {
        const res = await authFetch("/api/admin/events", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            endsAt: payload.endsAt ?? undefined,
            inviteEmails: selectedInvitees.map((inv) => ({
              email: inv.email,
              fullName: inv.fullName,
              companyName: inv.companyName,
              contactId: inv.contactId,
              status: inv.inviteAs,
            })),
          }),
        });
        const json = (await res.json()) as { ok?: boolean; id?: string; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
        if (json.id) setActiveId(json.id);
      }
      await loadAll();
      setSaveOk(
        phaseLabel
          ? `${phaseLabel} — enregistré.`
          : "Événement enregistré.",
      );
      window.setTimeout(() => setSaveOk(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function phaseSaveFooter(phaseLabel: string, hint?: string) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void saveEvent(phaseLabel)}
          disabled={saving}
          className={`${BTN_PRIMARY} inline-flex items-center gap-2`}
        >
          <Save className="h-4 w-4" />
          {saving ? "Enregistrement…" : "Enregistrer cette étape"}
        </button>
        {saveOk ? (
          <span className="text-xs font-medium text-emerald-700" role="status">
            {saveOk}
          </span>
        ) : (
          <span className="text-xs text-ns-secondary">
            {hint ?? "Les champs de cette phase sont enregistrés avec l’événement."}
          </span>
        )}
      </div>
    );
  }

  async function deleteEvent() {
    if (!activeId) return;
    if (!confirm("Supprimer ce dîner ?")) return;
    try {
      const res = await authFetch(`/api/admin/events/${activeId}`, { method: "DELETE" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "delete_failed");
      openCreate();
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function setParticipationStatus(partId: string, next: AdminEventParticipation["status"]) {
    try {
      const res = await authFetch(`/api/admin/participations/${partId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function inviteFromWaitlist(partId: string) {
    setError(null);
    try {
      const res = await authFetch(`/api/admin/participations/${partId}/invite`, {
        method: "POST",
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "invite_failed");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function sendSaveTheDateBlast() {
    if (!activeId) return;
    setSendingSaveTheDate(true);
    setError(null);
    setInviteSendResult(null);
    try {
      const res = await authFetch(`/api/admin/events/${activeId}/send-save-the-date`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        sent?: number;
        skipped?: number;
        failed?: number;
        waitlistProvisioned?: number;
        error?: string;
        errors?: string[];
      };
      if (!res.ok && json.error === "no_recipients") {
        throw new Error("Aucun destinataire (invitees / waitlist).");
      }
      const provisioned = json.waitlistProvisioned ?? 0;
      const summary = `Save the Date — envoyés: ${json.sent ?? 0}, skip: ${json.skipped ?? 0}, échecs: ${json.failed ?? 0}${
        provisioned > 0 ? `, profils créés/réactivés: ${provisioned}` : ""
      }`;
      setInviteSendOk(Boolean(json.ok));
      setInviteSendResult(
        [summary, ...(json.errors ?? [])].filter(Boolean).join("\n"),
      );
      await loadAll();
    } catch (e) {
      setInviteSendOk(false);
      setInviteSendResult(e instanceof Error ? e.message : String(e));
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendingSaveTheDate(false);
    }
  }

  function openInviteModal() {
    if (!activeEvent) return;
    setInviteSendResult(null);
    setInviteSendOk(false);
    setInviteModalOpen(true);
  }

  function closeInviteModal() {
    setInviteModalOpen(false);
    setInviteSendResult(null);
    setInviteSendOk(false);
  }

  async function sendInvitations() {
    if (!activeId) return;
    setSendingInvites(true);
    setInviteSendResult(null);
    setInviteSendOk(false);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/events/${activeId}/send-invitations`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        sent?: number;
        failed?: number;
        skipped?: number;
        recipientCount?: number;
        error?: string;
        errors?: string[];
      };
      if (!res.ok || !json.ok) {
        const detail =
          json.errors && json.errors.length > 0 ? `\n${json.errors.join("\n")}` : "";
        throw new Error((json.error ?? "send_failed") + detail);
      }
      const detail =
        json.errors && json.errors.length > 0
          ? `\n${json.errors.join("\n")}`
          : "";
      const failed = json.failed ?? 0;
      const sent = json.sent ?? 0;
      setInviteSendOk(failed === 0 && sent > 0);
      setInviteSendResult(
        (failed === 0 && sent > 0
          ? `Invitations envoyées avec succès (${sent}/${json.recipientCount ?? sent}).`
          : `Envoyé : ${sent} / ${json.recipientCount ?? 0}`) +
          (failed > 0 ? ` · échecs : ${failed}` : "") +
          detail,
      );
      await loadAll();
    } catch (e) {
      setInviteSendOk(false);
      setInviteSendResult(e instanceof Error ? e.message : String(e));
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendingInvites(false);
    }
  }

  const invitedRecipientCount = useMemo(() => {
    return activeParticipations.filter((p) => p.status === "invited").length;
  }, [activeParticipations]);

  const publicUrl = activeEvent
    ? eventPublicUrl(publicBaseUrl, activeEvent.slug, eventLanguage)
    : "";

  const emailTemplate = activeEvent
    ? buildEmailTemplate(
        activeEvent.title,
        fmtDateTime(activeEvent.startsAt, eventLanguage),
        [activeEvent.venueName, activeEvent.address].filter(Boolean).join(" — "),
        publicUrl,
        eventLanguage,
      )
    : "";

  const whatsappTemplate = activeEvent
    ? buildWhatsappTemplate(
        activeEvent.title,
        fmtDateTime(activeEvent.startsAt, eventLanguage),
        publicUrl,
        eventLanguage,
      )
    : "";

  function personalizedWhatsappMessage(fullName?: string) {
    if (!activeEvent) return "";
    const where = [activeEvent.venueName, activeEvent.address].filter(Boolean).join(" — ");
    const template = buildWhatsappInviteMessage({
      title: activeEvent.title,
      when: fmtDateTime(activeEvent.startsAt, eventLanguage),
      where,
      url: publicUrl,
      lang: eventLanguage,
    });
    return applyInviteTemplateVars(template, {
      fullName: fullName ?? "",
      email: "",
      eventUrl: publicUrl,
    });
  }

  function openWhatsAppForParticipation(
    p: AdminEventParticipation,
    options?: { silentMissingPhone?: boolean },
  ) {
    const digits = toWhatsAppDigits(p.phone);
    if (!digits && !options?.silentMissingPhone) {
      window.alert(
        "Aucun téléphone trouvé pour ce contact (profil waitlist). Le chat WhatsApp s’ouvrira sans numéro prérempli.",
      );
    }
    const url = whatsappShareUrl(personalizedWhatsappMessage(p.fullName), digits);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function openWhatsAppForAll() {
    const targets = activeParticipations.filter(
      (p) =>
        p.status === "invited" ||
        p.status === "attending" ||
        p.status === "confirmed" ||
        p.status === "waitlist" ||
        p.status === "present",
    );
    if (targets.length === 0) return;
    const withPhone = targets.filter((p) => toWhatsAppDigits(p.phone));
    const without = targets.length - withPhone.length;
    const ok = window.confirm(
      `Ouvrir WhatsApp un par un pour ${targets.length} contact(s)` +
        (without > 0 ? ` (${without} sans numéro → choix manuel)` : "") +
        " ?\n\nAutorise les pop-ups si le navigateur le demande.",
    );
    if (!ok) return;
    for (let i = 0; i < targets.length; i += 1) {
      const p = targets[i]!;
      openWhatsAppForParticipation(p, { silentMissingPhone: true });
      await new Promise((r) => window.setTimeout(r, 700));
    }
  }

  if (loading) return <p className="text-sm text-ns-secondary">Chargement…</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-2">
        <button
          type="button"
          onClick={openCreate}
          className={`${BTN_PRIMARY} inline-flex w-full items-center justify-center gap-2`}
        >
          <Plus className="h-4 w-4" /> {labels.newEvent}
        </button>
        <ul className="space-y-1">
          {events.map((e) => {
            const when = (() => {
              try {
                return new Date(e.startsAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
              } catch {
                return "";
              }
            })();
            const place = e.venueName?.trim() || e.address?.trim() || "";
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => openEdit(e)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${activeId === e.id ? "bg-ns-primary/15 font-semibold text-ns-primary" : "hover:bg-ns-brand-light"}`}
                >
                  <span className="block truncate font-semibold">{e.title}</span>
                  {place ? (
                    <span className="mt-0.5 block truncate text-xs text-ns-secondary">{place}</span>
                  ) : null}
                  <span className="mt-0.5 block text-xs text-ns-secondary">
                    {labelEventFormat(e.format, "fr")}
                    {when ? ` · ${when}` : ""}
                    {when || e.format ? " · " : ""}
                    {labels[`eventStatus.${e.status ?? "draft"}`] ?? e.status}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-ns-hero">{labels.eventsTitle}</h2>
        {error && <p className={ERROR_TEXT}>{error}</p>}
        {saveOk && !error ? (
          <p className="text-sm font-medium text-emerald-700" role="status">
            {saveOk}
          </p>
        ) : null}

        <div className="space-y-3">
          <div>
            <h3 className={FORM_SECTION_TITLE}>
              {activeId
                ? (labels.editEvent ?? "Modifier le dîner")
                : labels.newEvent}
            </h3>
            <p className="mt-1 text-sm text-ns-secondary">
              Une étape à la fois — en-tête = situation + action prioritaire.
            </p>
          </div>

          <EventCommandHeader
            title={title.trim() || (activeEvent?.title ?? "")}
            modeLabel={isInterestMode ? "Save the Date / interest" : "RSVP classique"}
            phaseLabel={
              journeyPhases.find((p) => p.id === focusPhase)?.title ?? focusPhase
            }
            phaseSummary={journeyPhases.find((p) => p.id === focusPhase)?.summary}
            kpis={opsSuggestion.kpis}
            blockers={opsSuggestion.blockers}
            nextBestAction={opsSuggestion.nextBestAction}
            onDoNextBestAction={() =>
              focusOnPhase(opsSuggestion.nextBestAction.phaseId, {
                fromSuggestion: true,
              })
            }
            showResetSuggested={
              phaseOverride && focusPhase !== opsSuggestion.phaseId
            }
            onResetToSuggested={applySuggestedPhase}
          />

          <EventCommandPhaseNav
            phases={journeyPhases}
            activeId={focusPhase}
            completedIds={opsSuggestion.completedPhaseIds}
            suggestedId={opsSuggestion.phaseId}
            onJump={jumpToPhase}
          />

          <div id="event-command-workzone" className="scroll-mt-28 space-y-3">
          <EventPhaseSection
            hideWhenCollapsed
            phase={phaseMeta("prep")}
            open={focusPhase === "prep"}
            onToggle={() => jumpToPhase("prep")}
            footer={phaseSaveFooter(
              "Préparation",
              "Identité, calendrier, lieu, tarif, publish…",
            )}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>{labels["fields.title"]} *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Ex. IA & entrepreneurs Guadalajara"
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="event-mesa-number">
                  {labels["fields.mesaNumber"] ?? "N° MESA (calendrier masqué)"}
                </label>
                <input
                  id="event-mesa-number"
                  type="number"
                  min={1}
                  max={9999}
                  value={mesaNumber}
                  onChange={(e) => setMesaNumber(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="1 → LA MESA 001"
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="event-format">
                  {labels["fields.format"] ?? "Format"}
                </label>
                <select
                  id="event-format"
                  className={INPUT_CLASS}
                  value={format}
                  onChange={(e) => {
                    const next = e.target.value as EventFormat;
                    setFormat(next);
                    if (!activeId) {
                      const times = defaultTimesForFormat(next);
                      setStartTime(times.startTime);
                      setEndTime(times.endTime);
                    }
                  }}
                >
                  {EVENT_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {labels[`format.${f}`] ?? labelEventFormat(f, "fr")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="event-city">
                  {labels["fields.city"] ?? "Ville (hub)"}
                </label>
                <select
                  id="event-city"
                  className={INPUT_CLASS}
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
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>{labels["fields.organizer"]}</label>
                <input
                  value={organizerName}
                  onChange={(e) => setOrganizerName(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="LA MESA"
                />
              </div>
              <div className="sm:col-span-2 flex items-start gap-3">
                <input
                  id="event-share-enabled"
                  type="checkbox"
                  checked={shareEnabled}
                  onChange={(e) => setShareEnabled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-ns-primary"
                />
                <label htmlFor="event-share-enabled" className="cursor-pointer text-sm text-ns-tertiary">
                  <span className="font-semibold">
                    {labels["fields.shareEnabled"] ??
                      "Autoriser le partage de l'invitation par les membres"}
                  </span>
                </label>
              </div>
              <div>
                <label className={LABEL_CLASS}>{labels["fields.date"]} *</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  onClick={openNativePicker}
                  onFocus={openNativePicker}
                  className={`${INPUT_CLASS} cursor-pointer`}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>{labels["fields.startsAt"]} *</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  onClick={openNativePicker}
                  onFocus={openNativePicker}
                  className={`${INPUT_CLASS} cursor-pointer`}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>{labels["fields.endsAt"]}</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  onClick={openNativePicker}
                  onFocus={openNativePicker}
                  className={`${INPUT_CLASS} cursor-pointer`}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>{labels["fields.capacity"]}</label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>{labels["fields.intro"]}</label>
                <textarea
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  rows={3}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="sm:col-span-2">
                <EventDescriptionPresetsBar
                  introText={introText}
                  subtitle={subtitle}
                  menuIncluded={menuIncluded}
                  onApply={(preset) => {
                    setIntroText(preset.introText);
                    setSubtitle(preset.subtitle);
                    setMenuIncluded(preset.menuIncluded);
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>{labels["fields.flyerUrl"]}</label>
                <input
                  type="url"
                  value={flyerUrl}
                  onChange={(e) => setFlyerUrl(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="https://..."
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>{labels["fields.registrationFormUrl"]}</label>
                <input
                  type="url"
                  value={registrationFormUrl}
                  onChange={(e) => setRegistrationFormUrl(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>{labels["fields.eventLanguage"]}</label>
                <select
                  value={eventLanguage}
                  onChange={(e) => setEventLanguage(e.target.value as typeof eventLanguage)}
                  className={INPUT_CLASS}
                >
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Mode de réponse publique</label>
                <select
                  value={responseMode}
                  onChange={(e) => setResponseMode(e.target.value as "rsvp" | "interest")}
                  className={INPUT_CLASS}
                >
                  <option value="rsvp">RSVP classique (confirmer présence)</option>
                  <option value="interest">Save the Date / intérêt (OUI/NON/AUTRE)</option>
                </select>
              </div>
            </div>
            {isInterestMode ? (
              <div className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                <div>
                  <label className={LABEL_CLASS}>Sous-titre</label>
                  <input
                    className={INPUT_CLASS}
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Guadalajara · entraide & réseau d’affaires"
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Deadline réponse (intérêt)</label>
                  <input
                    type="datetime-local"
                    className={INPUT_CLASS}
                    value={interestDeadlineAt}
                    onChange={(e) => setInterestDeadlineAt(e.target.value)}
                    onClick={openNativePicker}
                  />
                </div>
              </div>
            ) : null}

            <div className="border-t border-gray-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ns-secondary">
                Lieu, tarif & publication
              </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>{labels["fields.venueName"]}</label>
                <input
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Restaurant, rooftop…"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>{labels["fields.address"]}</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Rue, colonia, ville…"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_CLASS}>{labels["fields.mapsUrl"]}</label>
                <input
                  type="url"
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="https://maps.google.com/…"
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>{labels["fields.dressCode"]}</label>
                <select
                  value={dressCode ?? "none_specified"}
                  onChange={(e) => setDressCode(e.target.value as DressCode)}
                  className={INPUT_CLASS}
                >
                  {DRESS_CODES.map((code) => (
                    <option key={code} value={code}>
                      {labels[`dress.${code}`] ?? code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>{labels["fields.status"]}</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  className={INPUT_CLASS}
                >
                  <option value="draft">{labels["eventStatus.draft"]}</option>
                  <option value="published">{labels["eventStatus.published"]}</option>
                  <option value="closed">{labels["eventStatus.closed"]}</option>
                </select>
              </div>
            <div className="sm:col-span-2 space-y-4">
              <div className="rounded-xl border border-ns-alternate bg-ns-brand-light/50 p-4">
                <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-ns-tertiary">
                  {labels["fields.pricingMode"] ?? "Mode de tarification"}
                </h3>
                <p className="mb-3 text-xs text-ns-secondary">
                  {labels["fields.pricingModeHint"] ??
                    "Choisis comment l’invité paie : ticket + sur place, ou ticket avec boissons incluses."}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2 text-sm ${
                      pricingMode === "ticket_onsite"
                        ? "border-ns-primary bg-white"
                        : "border-ns-alternate bg-white/60"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold text-ns-tertiary">
                      <input
                        type="radio"
                        name="pricingMode"
                        checked={pricingMode === "ticket_onsite"}
                        onChange={() => setPricingMode("ticket_onsite")}
                        className="h-4 w-4"
                      />
                      {labels["fields.pricingModeTicket"] ?? "Ticket + consommations sur place"}
                    </span>
                    <span className="pl-6 text-xs text-ns-secondary">
                      {labels["fields.pricingModeTicketHint"] ??
                        "L’invité paie d’abord un ticket pour confirmer, puis le repas / conso sur place."}
                    </span>
                  </label>
                  <label
                    className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2 text-sm ${
                      pricingMode === "all_inclusive"
                        ? "border-ns-primary bg-white"
                        : "border-ns-alternate bg-white/60"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold text-ns-tertiary">
                      <input
                        type="radio"
                        name="pricingMode"
                        checked={pricingMode === "all_inclusive"}
                        onChange={() => setPricingMode("all_inclusive")}
                        className="h-4 w-4"
                      />
                      {labels["fields.pricingModeAllIn"] ?? "Ticket avec boissons incluses"}
                    </span>
                    <span className="pl-6 text-xs text-ns-secondary">
                      {labels["fields.pricingModeAllInHint"] ??
                        "Un seul ticket couvre l’accès, le repas et les boissons (tu peux aussi les laisser à part)."}
                    </span>
                  </label>
                </div>
              </div>

              {pricingMode === "ticket_onsite" ? (
                <>
                  <div className="rounded-xl border border-ns-alternate bg-ns-brand-light/50 p-4">
                    <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-ns-tertiary">
                      {labels["fields.accessSection"] ?? "TICKET — confirmation de place"}
                    </h3>
                    <p className="mb-3 text-xs text-ns-secondary">
                      {labels["fields.accessSectionHint"] ??
                        "Montant payé à l’avance pour confirmer la place (virement). Les consommations se règlent sur place."}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={LABEL_CLASS}>
                          {labels["fields.priceMxn"] ?? "Ticket (MXN / pers., hors IVA)"}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={priceMxn}
                          onChange={(e) => setPriceMxn(e.target.value)}
                          className={INPUT_CLASS}
                          placeholder="450"
                        />
                        <p className="mt-1 text-xs text-ns-secondary">
                          {labels["fields.priceMxnHint"] ??
                            "Montant libre à préciser. L’IVA (16%) et le total TTC sont calculés automatiquement."}
                        </p>
                        {(() => {
                          const n = priceMxn.trim() === "" ? 0 : Number(priceMxn);
                          if (!Number.isFinite(n) || n <= 0) return null;
                          const { iva, totalWithIva } = computeEventIva(n);
                          return (
                            <div className="mt-2 rounded-lg border border-ns-alternate bg-white px-3 py-2 text-xs text-ns-tertiary">
                              <p>
                                {labels["fields.ivaLabel"] ?? "IVA (16%)"}:{" "}
                                <strong>{formatMxn(iva, "es")}</strong>
                              </p>
                              <p className="mt-0.5">
                                {labels["fields.totalWithIva"] ?? "Total avec IVA"}:{" "}
                                <strong>{formatMxn(totalWithIva, "es")}</strong>
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="space-y-3">
                        <p className={`${LABEL_CLASS} mb-0`}>
                          {labels["fields.accessIncludes"] ?? "Inclus dans le ticket"}
                        </p>
                        <label className="flex items-center gap-2 text-sm text-ns-tertiary">
                          <input
                            type="checkbox"
                            checked={accessIncludesWelcomeDrink}
                            onChange={(e) => setAccessIncludesWelcomeDrink(e.target.checked)}
                            className="h-4 w-4 rounded border-ns-alternate"
                          />
                          {labels["fields.accessWelcomeDrink"] ?? "Welcome drink"}
                        </label>
                        <label className="flex items-center gap-2 text-sm text-ns-tertiary">
                          <input
                            type="checkbox"
                            checked={accessIncludesAmuseBouche}
                            onChange={(e) => setAccessIncludesAmuseBouche(e.target.checked)}
                            className="h-4 w-4 rounded border-ns-alternate"
                          />
                          {labels["fields.accessAmuseBouche"] ?? "Amuse-bouches"}
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-ns-alternate bg-ns-brand-light/50 p-4">
                    <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-ns-tertiary">
                      {labels["fields.menuSection"] ?? "CONSOMMATIONS — sur place"}
                    </h3>
                    <p className="mb-3 text-xs text-ns-secondary">
                      {labels["fields.menuSectionHint"] ??
                        "Payé par l’invité au restaurant, même si un menu a été pré-négocié. Estimation possible."}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className={LABEL_CLASS}>
                          {labels["fields.menuIncluded"] ?? "Description du menu / conso"}
                        </label>
                        <textarea
                          value={menuIncluded}
                          onChange={(e) => setMenuIncluded(e.target.value)}
                          rows={4}
                          className={INPUT_CLASS}
                          placeholder="Entrée / plato fuerte / postre · opciones…"
                        />
                        <p className="mt-1 text-xs text-ns-secondary">
                          {labels["fields.menuIncludedHint"] ??
                            "Ce que le restaurant propose (hors ticket de confirmation)."}
                        </p>
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>
                          {labels["fields.menuPriceMinMxn"] ?? "Estimation min (MXN / pers.)"}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={menuPriceMinMxn}
                          onChange={(e) => setMenuPriceMinMxn(e.target.value)}
                          className={INPUT_CLASS}
                          placeholder="500"
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>
                          {labels["fields.menuPriceMaxMxn"] ?? "Estimation max (MXN / pers.)"}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={menuPriceMaxMxn}
                          onChange={(e) => setMenuPriceMaxMxn(e.target.value)}
                          className={INPUT_CLASS}
                          placeholder="1500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={LABEL_CLASS}>
                          {labels["fields.menuIncludesDrinks"] ?? "Boissons dans l’estimation ?"}
                        </label>
                        <select
                          value={menuIncludesDrinks}
                          onChange={(e) =>
                            setMenuIncludesDrinks(e.target.value as "unspecified" | "yes" | "no")
                          }
                          className={INPUT_CLASS}
                        >
                          <option value="unspecified">
                            {labels["fields.menuIncludesDrinksUnspecified"] ?? "Non précisé"}
                          </option>
                          <option value="yes">
                            {labels["fields.menuIncludesDrinksYes"] ?? "Oui — boissons incluses"}
                          </option>
                          <option value="no">
                            {labels["fields.menuIncludesDrinksNo"] ??
                              "Non — boissons à part (participant)"}
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-ns-alternate bg-ns-brand-light/50 p-4">
                  <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-ns-tertiary">
                    {labels["fields.allInSection"] ?? "TICKET AVEC BOISSONS INCLUSES"}
                  </h3>
                  <p className="mb-3 text-xs text-ns-secondary">
                    {labels["fields.allInSectionHint"] ??
                      "Un seul montant payé à l’avance : accès + repas + boissons (ou boissons à part si tu le précises)."}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={LABEL_CLASS}>
                        {labels["fields.allInTicketMxn"] ?? "Ticket avec boissons incluses (MXN / pers., hors IVA)"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={priceMxn}
                        onChange={(e) => setPriceMxn(e.target.value)}
                        className={INPUT_CLASS}
                        placeholder="1000"
                      />
                      <p className="mt-1 text-xs text-ns-secondary">
                        {labels["fields.allInTicketHint"] ??
                          "Montant libre. L’IVA (16%) et le total TTC sont calculés automatiquement."}
                      </p>
                      {(() => {
                        const n = priceMxn.trim() === "" ? 0 : Number(priceMxn);
                        if (!Number.isFinite(n) || n <= 0) return null;
                        const { iva, totalWithIva } = computeEventIva(n);
                        return (
                          <div className="mt-2 rounded-lg border border-ns-alternate bg-white px-3 py-2 text-xs text-ns-tertiary">
                            <p>
                              {labels["fields.ivaLabel"] ?? "IVA (16%)"}:{" "}
                              <strong>{formatMxn(iva, "es")}</strong>
                            </p>
                            <p className="mt-0.5">
                              {labels["fields.totalWithIva"] ?? "Total avec IVA"}:{" "}
                              <strong>{formatMxn(totalWithIva, "es")}</strong>
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>
                        {labels["fields.allInDrinks"] ?? "Boissons"}
                      </label>
                      <select
                        value={menuIncludesDrinks}
                        onChange={(e) =>
                          setMenuIncludesDrinks(e.target.value as "unspecified" | "yes" | "no")
                        }
                        className={INPUT_CLASS}
                      >
                        <option value="unspecified">
                          {labels["fields.menuIncludesDrinksUnspecified"] ?? "Non précisé"}
                        </option>
                        <option value="yes">
                          {labels["fields.allInDrinksYes"] ?? "Incluses dans le ticket"}
                        </option>
                        <option value="no">
                          {labels["fields.allInDrinksNo"] ?? "À part — réglées sur place"}
                        </option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={LABEL_CLASS}>
                        {labels["fields.menuIncluded"] ?? "Ce qui est inclus (menu)"}
                      </label>
                      <textarea
                        value={menuIncluded}
                        onChange={(e) => setMenuIncluded(e.target.value)}
                        rows={3}
                        className={INPUT_CLASS}
                        placeholder="Entrées + plat + dessert…"
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>
                        {labels["fields.allInPriceMinMxn"] ?? "Fourchette min (optionnel, MXN)"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={allInPriceMinMxn}
                        onChange={(e) => setAllInPriceMinMxn(e.target.value)}
                        className={INPUT_CLASS}
                        placeholder="800"
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>
                        {labels["fields.allInPriceMaxMxn"] ?? "Fourchette max (optionnel, MXN)"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={allInPriceMaxMxn}
                        onChange={(e) => setAllInPriceMaxMxn(e.target.value)}
                        className={INPUT_CLASS}
                        placeholder="1000"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-ns-alternate bg-ns-brand-light/50 p-4">
                <label className={LABEL_CLASS}>
                  {labels["fields.paymentDeadlineAt"] ?? "Date butoir règlement ACCESS"}
                </label>
                <input
                  type="datetime-local"
                  className={INPUT_CLASS}
                  value={paymentDeadlineAt}
                  onChange={(e) => setPaymentDeadlineAt(e.target.value)}
                  onClick={openNativePicker}
                />
                <p className="mt-1 text-xs text-ns-secondary">
                  {labels["fields.paymentDeadlineAtHint"] ??
                    "Affichée dans l’invitation formelle (coordonnées bancaires). Si vide : formulation générique « date butoir de l’événement »."}
                </p>
              </div>


              <div className="rounded-xl border border-ns-alternate bg-white p-4">
                <label className="flex items-start gap-2 text-sm text-ns-tertiary">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-ns-alternate"
                    checked={parking !== "unknown"}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setParking(parking === "unknown" ? "valet" : parking);
                      } else {
                        setParking("unknown");
                      }
                    }}
                  />
                  <span>
                    <span className="font-semibold">
                      {labels["fields.parkingAvailable"] ??
                        "Parking / valet disponible sur place"}
                    </span>
                    <span className="mt-0.5 block text-xs text-ns-secondary">
                      {labels["fields.parkingAvailableHint"] ??
                        "Règlement indépendant sur place (hors ticket)."}
                    </span>
                  </span>
                </label>
                {parking !== "unknown" ? (
                  <div className="mt-3">
                    <label className={LABEL_CLASS}>
                      {labels["fields.parkingType"] ?? "Type de parking"}
                    </label>
                    <select
                      value={parking}
                      onChange={(e) => setParking(e.target.value as Parking)}
                      className={INPUT_CLASS}
                    >
                      {PARKING_OPTIONS.filter((opt) => opt !== "unknown").map((opt) => (
                        <option key={opt} value={opt}>
                          {labels[`parking.${opt}`] ?? opt}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </div>


            </div>
            </div>
          </EventPhaseSection>


          <EventPhaseSection
            hideWhenCollapsed
            phase={phaseMeta("audience")}
            open={focusPhase === "audience"}
            onToggle={() => jumpToPhase("audience")}
          >
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
                {labels.inviteGroup ?? "Constituer un groupe (invités)"}
              </h4>
              <p className="mt-1 mb-3 text-xs text-ns-secondary">
                {labels.inviteGroupHint ??
                  "Recherche par nom/société/email. Au-delà des places → liste d’attente."}
              </p>
              <ContactPicker
                selected={selectedInvitees}
                onChange={setSelectedInvitees}
                labels={{
                  search: labels.searchContacts,
                  selected: activeId
                    ? `${labels.selectedContacts} (à ajouter)`
                    : labels.selectedContacts,
                  addExternal: labels.addExternal,
                  externalEmail: "Email",
                  externalName: "Nom",
                }}
              />
            </div>
            {activeEvent ? (
              <AdminEventParticipantRoster
                participations={activeParticipations}
                capacity={activeEvent.capacity ?? guestCapacityFromTotalCovers(capacity)}
                title={labels.selectedContacts}
                labels={{
                  invited: labels["statuses.invited"],
                  attending: labels["statuses.attending"] ?? "Attending",
                  confirmed: labels["statuses.confirmed"] ?? "Confirmé",
                  not_attending: labels["statuses.not_attending"] ?? "Not attending",
                  waitlist: labels["statuses.waitlist"],
                  seatedSummary: labels.seatingSummary,
                }}
                onStatusChange={(id, status) => void setParticipationStatus(id, status)}
                onInviteFromWaitlist={(id) => void inviteFromWaitlist(id)}
                onWhatsApp={(p) => openWhatsAppForParticipation(p)}
                onWhatsAppAll={() => void openWhatsAppForAll()}
              />
            ) : (
              <p className="text-sm text-ns-secondary">
                Enregistre l’événement pour voir le roster participants.
              </p>
            )}
          </EventPhaseSection>

          {isInterestMode ? (
            <EventPhaseSection
              hideWhenCollapsed
              phase={phaseMeta("save_the_date")}
              open={focusPhase === "save_the_date"}
              onToggle={() => jumpToPhase("save_the_date")}
            >
              {activeEvent ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-100 bg-ns-brand-light p-4">
                    <p className="text-sm font-bold text-ns-hero">Lien public</p>
                    <a
                      href={publicUrl}
                      className="mt-1 break-all text-sm text-ns-primary hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {publicUrl}
                    </a>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={BTN_SECONDARY}
                        onClick={() => void navigator.clipboard.writeText(emailTemplate)}
                      >
                        <Copy className="mr-1 inline h-4 w-4" /> {labels.copyEmail}
                      </button>
                      <button
                        type="button"
                        className={BTN_SECONDARY}
                        onClick={() => void navigator.clipboard.writeText(whatsappTemplate)}
                      >
                        <Copy className="mr-1 inline h-4 w-4" /> {labels.copyWhatsapp}
                      </button>
                    </div>
                  </div>
                  <EventTemplateDrawer
                    event={activeEvent}
                    templateKey="save_the_date"
                    label="Éditer le modèle Save the Date"
                    onEventUpdated={() => void loadAll()}
                    hint="Personnalise avant l’envoi blast."
                  />
                  <button
                    type="button"
                    onClick={() => void sendSaveTheDateBlast()}
                    disabled={
                      sendingSaveTheDate ||
                      activeParticipations.filter(
                        (p) => p.status === "invited" || p.status === "waitlist",
                      ).length === 0
                    }
                    className={`${BTN_PRIMARY} inline-flex items-center gap-2`}
                    title="Envoie le Save the Date (lien page intérêt) aux invités / waitlist"
                  >
                    <Mail className="h-4 w-4" />{" "}
                    {sendingSaveTheDate ? "Envoi Save the Date…" : "Envoyer Save the Date"}
                  </button>
                  <AdminEventInterestInbox eventId={activeEvent.id} eventSlug={activeEvent.slug} />
                </div>
              ) : (
                <p className="text-sm text-ns-secondary">
                  Enregistre l’événement pour éditer le template STD et envoyer.
                </p>
              )}
            </EventPhaseSection>
          ) : null}

          {isInterestMode ? (
            <EventPhaseSection
              hideWhenCollapsed
              phase={phaseMeta("qualify")}
              open={focusPhase === "qualify"}
              onToggle={() => jumpToPhase("qualify")}
            >
              {activeEvent ? (
                <div className="space-y-4">
                  <StdRelancePanel event={activeEvent} />
                  <AdminEventInterestInbox eventId={activeEvent.id} eventSlug={activeEvent.slug} />
                </div>
              ) : (
                <p className="text-sm text-ns-secondary">
                  Enregistre l’événement pour qualifier les réponses.
                </p>
              )}
            </EventPhaseSection>
          ) : null}

          <EventPhaseSection
            hideWhenCollapsed
            phase={phaseMeta("formal")}
            open={focusPhase === "formal"}
            onToggle={() => jumpToPhase("formal")}
          >
            {activeEvent ? (
              isInterestMode ? (
                <div className="space-y-4">
                  <p className="text-xs text-ns-secondary">
                    Vérifie le prix et la date butoir (préparation) — ils alimentent{" "}
                    {"{{paymentDeadlineBlock}}"} et les montants dans le mail. Le suivi paiement
                    est dans l’étape suivante.
                  </p>
                  <EventTemplateDrawer
                    event={activeEvent}
                    templateKey="calendar_invite"
                    label="Éditer le modèle invitation formelle"
                    onEventUpdated={() => void loadAll()}
                    hint="Détails, prix, coordonnées bancaires."
                  />
                  <FormalInviteOuiPanel
                    event={activeEvent}
                    onEventUpdated={() => void loadAll()}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <EventTemplateDrawer
                    event={activeEvent}
                    templateKey="calendar_invite"
                    label="Éditer le modèle invitation"
                    onEventUpdated={() => void loadAll()}
                  />
                  <button
                    type="button"
                    onClick={openInviteModal}
                    disabled={activeParticipations.filter((p) => p.status === "invited").length === 0}
                    className={`${BTN_PRIMARY} inline-flex items-center gap-2`}
                    title="Envoie l’invitation calendrier (ICS + YES/NO) aux statuts Invité"
                  >
                    <Mail className="h-4 w-4" /> Lancer les invitations
                  </button>
                  <AdminEventParticipantRoster
                    participations={activeParticipations}
                    capacity={activeEvent.capacity ?? guestCapacityFromTotalCovers(capacity)}
                    title="Suivi participants"
                    labels={{
                      invited: labels["statuses.invited"],
                      attending: labels["statuses.attending"] ?? "Attending",
                      confirmed: labels["statuses.confirmed"] ?? "Confirmé",
                      not_attending: labels["statuses.not_attending"] ?? "Not attending",
                      waitlist: labels["statuses.waitlist"],
                      seatedSummary: labels.seatingSummary,
                    }}
                    onStatusChange={(id, status) => void setParticipationStatus(id, status)}
                    onInviteFromWaitlist={(id) => void inviteFromWaitlist(id)}
                    onWhatsApp={(p) => openWhatsAppForParticipation(p)}
                  />
                </div>
              )
            ) : (
              <p className="text-sm text-ns-secondary">Enregistre l’événement pour cette étape.</p>
            )}
          </EventPhaseSection>

          <EventPhaseSection
            hideWhenCollapsed
            phase={phaseMeta("payment")}
            open={focusPhase === "payment"}
            onToggle={() => jumpToPhase("payment")}
          >
            {activeEvent ? (
              <div className="space-y-4">
                <EventTemplateDrawer
                  event={activeEvent}
                  templateKey="payment_relance"
                  label="Éditer le modèle relance paiement"
                  onEventUpdated={() => void loadAll()}
                  hint="Relance ACCESS — bold/liens supportés."
                />
                <AdminEventPaymentFollowupPanel
                  event={activeEvent}
                  participations={activeParticipations}
                  onStatusChange={(id, status) => void setParticipationStatus(id, status)}
                  onWhatsApp={(p) => openWhatsAppForParticipation(p)}
                  onUpdated={() => void loadAll()}
                />
              </div>
            ) : (
              <p className="text-sm text-ns-secondary">Enregistre l’événement pour cette étape.</p>
            )}
          </EventPhaseSection>

          <EventPhaseSection
            hideWhenCollapsed
            phase={phaseMeta("dinner_prep")}
            open={focusPhase === "dinner_prep"}
            onToggle={() => jumpToPhase("dinner_prep")}
          >
            {activeEvent ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-xs text-ns-secondary">
                    Places restantes et last-call — puis composer les tables dans Tables.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/tables?eventId=${encodeURIComponent(activeEvent.id)}`}
                      className={`${BTN_PRIMARY} inline-flex items-center text-sm`}
                    >
                      Composer les tables →
                    </Link>
                    <Link
                      href={`/admin/tables?eventId=${encodeURIComponent(activeEvent.id)}&generate=1`}
                      className={`${BTN_SECONDARY} inline-flex items-center text-sm`}
                    >
                      Générer des idées
                    </Link>
                  </div>
                </div>
                <AdminEventPlacesAvailablePanel
                  event={activeEvent}
                  onEventUpdated={() => void loadAll()}
                />
              </div>
            ) : (
              <p className="text-sm text-ns-secondary">Enregistre l’événement pour cette étape.</p>
            )}
          </EventPhaseSection>

          <EventPhaseSection
            hideWhenCollapsed
            phase={phaseMeta("checkin")}
            open={focusPhase === "checkin"}
            onToggle={() => jumpToPhase("checkin")}
          >
            <p className="text-sm text-ns-secondary">
              Check-in le soir J — bientôt. En attendant, marque les présents dans le roster
              (statut Présent) depuis Audience ou Confirmation.
            </p>
            {activeEvent ? (
              <AdminEventParticipantRoster
                participations={activeParticipations}
                capacity={activeEvent.capacity ?? guestCapacityFromTotalCovers(capacity)}
                title="Présence"
                initialFilter="paid"
                labels={{
                  invited: labels["statuses.invited"],
                  attending: labels["statuses.attending"] ?? "Attending",
                  confirmed: labels["statuses.confirmed"] ?? "Confirmé",
                  not_attending: labels["statuses.not_attending"] ?? "Not attending",
                  waitlist: labels["statuses.waitlist"],
                  seatedSummary: labels.seatingSummary,
                }}
                onStatusChange={(id, status) => void setParticipationStatus(id, status)}
                onInviteFromWaitlist={(id) => void inviteFromWaitlist(id)}
                onWhatsApp={(p) => openWhatsAppForParticipation(p)}
              />
            ) : null}
          </EventPhaseSection>

          <EventPhaseSection
            hideWhenCollapsed
            phase={phaseMeta("feedback")}
            open={focusPhase === "feedback"}
            onToggle={() => jumpToPhase("feedback")}
          >
            {activeEvent ? (
              <div className="space-y-4">
                <AutoRemindersPanel
                  event={activeEvent}
                  participations={activeParticipations}
                  onEventUpdated={() => void loadAll()}
                />
                <AdminEventSatisfactionResults participations={activeParticipations} />
              </div>
            ) : (
              <p className="text-sm text-ns-secondary">Enregistre l’événement pour cette étape.</p>
            )}
          </EventPhaseSection>
          </div>

          <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 bg-white/95 p-4 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => void saveEvent()}
              disabled={saving}
              className={`${BTN_PRIMARY} inline-flex items-center gap-2`}
            >
              <Save className="h-4 w-4" />{" "}
              {saving ? "Enregistrement…" : labels.save}
            </button>
            {activeId && (
              <button
                type="button"
                onClick={() => void deleteEvent()}
                className={`${BTN_SECONDARY} inline-flex items-center gap-2 text-red-600`}
              >
                <Trash2 className="h-4 w-4" /> {labels.delete}
              </button>
            )}
            {saveOk ? (
              <span className="text-xs font-medium text-emerald-700" role="status">
                {saveOk}
              </span>
            ) : null}
          </div>
        </div>

        {inviteModalOpen && activeEvent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Lancer les invitations"
            onClick={closeInviteModal}
          >
            <div
              className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                <div>
                  <h3 className="text-lg font-bold text-ns-hero">Lancer les invitations</h3>
                  <p className="mt-1 text-xs text-ns-secondary">
                    Envoie l’invitation calendrier (.ics) avec boutons YES/NO aux invités (statut
                    Invité). Les templates sont éditables dans Dashboard → Templates email. La
                    Waiting List n’est pas contactée ici — utilise INVITER sur une ligne.
                  </p>
                </div>
                <button
                  type="button"
                  className="text-ns-secondary hover:text-ns-tertiary"
                  onClick={closeInviteModal}
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto px-5 py-4">
                <p className="text-sm text-ns-tertiary">
                  Destinataires : <strong>{invitedRecipientCount}</strong> invité
                  {invitedRecipientCount > 1 ? "s" : ""} + organisateur
                  {activeEvent.inviteEmailSentAt
                    ? ` · dernier envoi : ${new Date(activeEvent.inviteEmailSentAt).toLocaleString("fr-FR")}`
                    : ""}
                </p>
                {inviteSendResult && (
                  <div
                    className={`whitespace-pre-wrap rounded-lg border px-3 py-3 text-sm ${
                      inviteSendOk
                        ? "border-ns-primary/40 bg-ns-primary/15 font-semibold text-ns-hero"
                        : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    {inviteSendResult}
                    {inviteSendOk ? (
                      <p className="mt-2 text-xs font-normal text-ns-secondary">
                        Vérifie ta boîte mail (et celle de l’invité) — l’envoi est terminé. Tu
                        peux fermer cette fenêtre.
                      </p>
                    ) : null}
                  </div>
                )}
                {!inviteSendOk && (
                  <p className="text-xs text-ns-secondary">
                    Si un envoi échoue : vérifie que Brevo est configuré (`BREVO_API_KEY` +
                    `BREVO_FROM_EMAIL`) et que le domaine d’envoi est validé dans Brevo
                    (Senders &amp; IP / Domains). Le template « Invitation calendrier » doit
                    aussi être <strong>activé</strong> dans Dashboard → Templates.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
                <button type="button" className={BTN_SECONDARY} onClick={closeInviteModal}>
                  Fermer
                </button>
                {inviteSendOk ? (
                  <button type="button" className={BTN_PRIMARY} onClick={closeInviteModal}>
                    Terminé
                  </button>
                ) : (
                  <button
                    type="button"
                    className={BTN_PRIMARY}
                    disabled={sendingInvites || invitedRecipientCount === 0}
                    onClick={() => void sendInvitations()}
                  >
                    {sendingInvites ? "Envoi…" : `Envoyer à ${invitedRecipientCount}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
