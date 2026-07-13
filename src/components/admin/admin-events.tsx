"use client";

import { ContactPicker, type SelectedInvitee } from "@/components/admin/contact-picker";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { consumePendingInvitees } from "@/lib/admin/pending-invitees";
import { DRESS_CODES, PARKING_OPTIONS } from "@/lib/constants/form-options";
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
  buildWhatsappTemplate,
  eventPublicUrl,
  fmtDateTime,
} from "@/lib/events/utils";
import {
  countSeatedParticipations,
  totalCoversWithAdmin,
} from "@/lib/events/capacity";
import { Copy, Plus, Save, Trash2 } from "lucide-react";
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
  const [capacity, setCapacity] = useState(15);
  const [dressCode, setDressCode] = useState<DressCode>("none_specified");
  const [parking, setParking] = useState<Parking>("unknown");
  const [registrationFormUrl, setRegistrationFormUrl] = useState("");
  const [flyerUrl, setFlyerUrl] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "closed">("draft");
  const [eventLanguage, setEventLanguage] = useState<"fr" | "en" | "es">(locale);
  const [selectedInvitees, setSelectedInvitees] = useState<SelectedInvitee[]>([]);

  const activeEvent = useMemo(
    () => events.find((e) => e.id === activeId) ?? null,
    [events, activeId],
  );

  const activeParticipations = useMemo(
    () => participations.filter((p) => p.eventId === activeId),
    [participations, activeId],
  );

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

  function resetForm(invitees: SelectedInvitee[] = []) {
    const now = splitLocal(new Date().toISOString());
    setActiveId(null);
    setTitle("");
    setOrganizerName("LA MESA");
    setShareEnabled(false);
    setIntroText("");
    setVenueName("");
    setAddress("");
    setMapsUrl("");
    setEventDate(now.date);
    setStartTime("19:30");
    setEndTime("22:30");
    setCapacity(Math.max(15, invitees.length || 15));
    setDressCode("none_specified");
    setParking("unknown");
    setRegistrationFormUrl("");
    setFlyerUrl("");
    setStatus("draft");
    setEventLanguage(locale);
    setSelectedInvitees(invitees);
  }

  useEffect(() => {
    const pending = consumePendingInvitees();
    const wantsNew =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("nouveau") === "1";
    if (pending.length === 0 && !wantsNew) return;
    resetForm(pending);
    if (wantsNew && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("nouveau");
      window.history.replaceState({}, "", url.pathname);
    }
    // seed once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    resetForm([]);
  }

  function openEdit(event: AdminEvent) {
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
    setCapacity(event.capacity ?? 15);
    setDressCode(event.dressCode ?? "none_specified");
    setParking(event.parking ?? "unknown");
    setRegistrationFormUrl(event.registrationFormUrl ?? "");
    setFlyerUrl(event.flyerUrl ?? "");
    setStatus(event.status ?? "draft");
    setEventLanguage(event.eventLanguage ?? locale);
    setSelectedInvitees([]);
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
      capacity,
      status,
      eventLanguage,
      dressCode,
      parking,
      shareEnabled,
    };
  }

  async function saveEvent() {
    if (!title.trim() || !eventDate || !startTime) return;
    setSaving(true);
    setError(null);
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
            })),
          }),
        });
        const json = (await res.json()) as { ok?: boolean; id?: string; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "save_failed");
        if (json.id) setActiveId(json.id);
      }
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
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
          {events.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => openEdit(e)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${activeId === e.id ? "bg-ns-primary/15 font-semibold text-ns-primary" : "hover:bg-ns-brand-light"}`}
              >
                {e.title}
                <span className="block text-xs text-ns-secondary">
                  {labels[`eventStatus.${e.status ?? "draft"}`] ?? e.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-ns-hero">{labels.eventsTitle}</h2>
        {error && <p className={ERROR_TEXT}>{error}</p>}

        <section className="space-y-4 rounded-2xl border border-gray-100 bg-ns-surface p-5">
          <div>
            <h3 className={FORM_SECTION_TITLE}>{labels.newEvent}</h3>
            <p className="mt-1 text-sm text-ns-secondary">
              {labels.formHint ?? "Renseigne les infos, puis compose un groupe d’invités."}
            </p>
          </div>

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
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS}>{labels["fields.organizer"]}</label>
              <input
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                className={INPUT_CLASS}
                placeholder="LA MESA"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-ns-tertiary">
                <input
                  type="checkbox"
                  checked={shareEnabled}
                  onChange={(e) => setShareEnabled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-ns-primary"
                />
                <span>
                  <span className="font-semibold">
                    {labels["fields.shareEnabled"] ??
                      "Autoriser le partage de l'invitation par les membres"}
                  </span>
                  <span className="mt-0.5 block text-xs text-ns-secondary">
                    {labels["fields.shareEnabledHint"] ??
                      "Affiche un bouton “Partager” côté membres (lien /e/…)."}
                  </span>
                </span>
              </label>
            </div>

            <div>
              <label className={LABEL_CLASS}>{labels["fields.date"]} *</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>{labels["fields.startsAt"]} *</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>{labels["fields.endsAt"]}</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>{labels["fields.capacity"]}</label>
              <input
                type="number"
                min={1}
                max={100}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-ns-secondary">
                {labels["fields.capacityHint"] ??
                  `${capacity} invités + toi (admin) = ${totalCoversWithAdmin(capacity)} couverts. Au-delà → liste d'attente.`}
              </p>
            </div>

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
              <label className={LABEL_CLASS}>{labels["fields.registrationFormUrl"]}</label>
              <input
                type="url"
                value={registrationFormUrl}
                onChange={(e) => setRegistrationFormUrl(e.target.value)}
                className={INPUT_CLASS}
                placeholder="https://..."
              />
              <p className="mt-1 text-xs text-ns-secondary">
                {labels["fields.registrationFormUrlHint"] ??
                  "Affiché en encart sur la page publique."}
              </p>
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
              <p className="mt-1 text-xs text-ns-secondary">
                {labels["fields.flyerUrlHint"] ??
                  "Image/PDF/page. Visible depuis la page publique."}
              </p>
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
              <label className={LABEL_CLASS}>{labels["fields.parking"]}</label>
              <select
                value={parking ?? "unknown"}
                onChange={(e) => setParking(e.target.value as Parking)}
                className={INPUT_CLASS}
              >
                {PARKING_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {labels[`parking.${opt}`] ?? opt}
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
          </div>

          <div className="border-t border-gray-100 pt-4">
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

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveEvent()}
              disabled={saving}
              className={`${BTN_PRIMARY} inline-flex items-center gap-2`}
            >
              <Save className="h-4 w-4" /> {labels.save}
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
          </div>
        </section>

        {activeEvent && (
          <>
            <section className="rounded-2xl border border-gray-100 bg-ns-brand-light p-5">
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
            </section>

            <section className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
              <h3 className={FORM_SECTION_TITLE}>{labels.selectedContacts}</h3>
              {(() => {
                const seatCap = activeEvent.capacity ?? capacity ?? 15;
                const seated = countSeatedParticipations(activeParticipations);
                const waitlistCount = activeParticipations.filter(
                  (p) => p.status === "waitlist",
                ).length;
                const summary =
                  labels.seatingSummary
                    ?.replace("{seated}", String(seated))
                    .replace("{capacity}", String(seatCap))
                    .replace("{waitlist}", String(waitlistCount))
                    .replace("{total}", String(totalCoversWithAdmin(seatCap))) ??
                  `${seated}/${seatCap} places · ${waitlistCount} en attente · ${totalCoversWithAdmin(seatCap)} couverts avec toi`;
                return <p className="mt-1 text-xs text-ns-secondary">{summary}</p>;
              })()}
              <ul className="mt-3 space-y-2">
                {activeParticipations.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ns-alternate px-3 py-2 text-sm"
                  >
                    <span>
                      {p.fullName ?? p.email}
                      {p.companyName ? ` · ${p.companyName}` : ""}
                    </span>
                    <select
                      value={p.status}
                      onChange={(e) =>
                        void setParticipationStatus(
                          p.id,
                          e.target.value as AdminEventParticipation["status"],
                        )
                      }
                      className="rounded border border-ns-alternate px-2 py-1 text-xs"
                    >
                      <option value="invited">{labels["statuses.invited"]}</option>
                      <option value="present">{labels["statuses.present"]}</option>
                      <option value="waitlist">{labels["statuses.waitlist"]}</option>
                      <option value="declined">{labels["statuses.declined"]}</option>
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
