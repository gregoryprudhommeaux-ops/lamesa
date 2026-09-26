"use client";

import {
  countRosterFilters,
  filterParticipationsForRoster,
  ROSTER_FILTERS,
  rosterCanonicalStatus,
  type RosterFilterId,
} from "@/lib/admin/event-participant-roster";
import { resolveGuestJourneyStage } from "@/lib/admin/guest-journey";
import {
  INTEREST_DISPLAY_LABELS,
  resolveInterestDisplay,
  type InterestDisplayStatus,
} from "@/lib/admin/interest-display";
import { countSeatedParticipations, totalCoversWithAdmin } from "@/lib/events/capacity";
import type { AdminEventParticipation, EventParticipationStatus } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, FORM_SECTION_TITLE } from "@/lib/ui/nextstep";
import { MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";

type StatusLabels = Partial<Record<EventParticipationStatus, string>> & {
  seatedSummary?: string;
};

type AdminEventParticipantRosterProps = {
  participations: AdminEventParticipation[];
  capacity?: number;
  labels?: StatusLabels;
  title?: string;
  initialFilter?: RosterFilterId;
  /** Interest-mode STD answer by email (oui/non/autre/sans_reponse). */
  interestByEmail?: Record<string, InterestDisplayStatus> | null;
  onStatusChange: (id: string, status: EventParticipationStatus) => void;
  onInviteFromWaitlist?: (id: string) => void;
  onWhatsApp?: (p: AdminEventParticipation) => void;
  onWhatsAppAll?: () => void;
};

const DEFAULT_STATUS_LABELS: Record<
  Exclude<EventParticipationStatus, "present" | "declined">,
  string
> = {
  invited: "À payer",
  attending: "Présent (RSVP)",
  confirmed: "Payé",
  comped: "Invité",
  not_attending: "Ne vient pas",
  waitlist: "Waitlist",
};

export function AdminEventParticipantRoster({
  participations,
  capacity = 0,
  labels = {},
  title = "Participants",
  initialFilter = "all",
  interestByEmail = null,
  onStatusChange,
  onInviteFromWaitlist,
  onWhatsApp,
  onWhatsAppAll,
}: AdminEventParticipantRosterProps) {
  const [filter, setFilter] = useState<RosterFilterId>(initialFilter);
  const [interestFilter, setInterestFilter] = useState<InterestDisplayStatus | "all">("all");
  const counts = useMemo(() => countRosterFilters(participations), [participations]);
  const statusRows = useMemo(
    () => filterParticipationsForRoster(participations, filter),
    [participations, filter],
  );
  const interestCounts = useMemo(() => {
    const out = { oui: 0, non: 0, autre: 0, sans_reponse: 0 };
    if (!interestByEmail) return out;
    for (const p of statusRows) {
      const s = resolveInterestDisplay(p.email, interestByEmail);
      if (s) out[s] += 1;
    }
    return out;
  }, [statusRows, interestByEmail]);
  const rows = useMemo(() => {
    if (!interestByEmail || interestFilter === "all") return statusRows;
    return statusRows.filter(
      (p) => resolveInterestDisplay(p.email, interestByEmail) === interestFilter,
    );
  }, [statusRows, interestByEmail, interestFilter]);
  const seated = countSeatedParticipations(participations);
  const waitlistCount = counts.waitlist;

  const summary =
    labels.seatedSummary
      ?.replace("{seated}", String(seated))
      .replace("{capacity}", String(capacity))
      .replace("{waitlist}", String(waitlistCount))
      .replace("{total}", String(totalCoversWithAdmin(capacity))) ??
    `${seated}/${capacity || "—"} places · ${waitlistCount} waitlist · ${totalCoversWithAdmin(capacity)} couverts (dont org.)`;

  return (
    <section className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={FORM_SECTION_TITLE}>{title}</h3>
        {onWhatsAppAll ? (
          <button
            type="button"
            className={`${BTN_SECONDARY} inline-flex items-center gap-1 text-xs`}
            onClick={onWhatsAppAll}
            disabled={participations.length === 0}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp à tous
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-ns-secondary">{summary}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ROSTER_FILTERS.map((f) => {
          const active = filter === f.id;
          const n = counts[f.id];
          if (f.id !== "all" && n === 0) return null;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                active
                  ? "bg-ns-primary text-ns-tertiary"
                  : "border border-ns-alternate bg-white text-ns-secondary hover:border-ns-primary"
              }`}
            >
              {f.label}
              <span className="ml-1 opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {interestByEmail ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(
            [
              { id: "all" as const, label: "Intérêt · tous", count: statusRows.length },
              { id: "oui" as const, label: "OUI", count: interestCounts.oui },
              { id: "non" as const, label: "NON", count: interestCounts.non },
              { id: "autre" as const, label: "AUTRE", count: interestCounts.autre },
              {
                id: "sans_reponse" as const,
                label: "Sans réponse",
                count: interestCounts.sans_reponse,
              },
            ] as const
          ).map((f) => {
            if (f.id !== "all" && f.count === 0) return null;
            const active = interestFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setInterestFilter(f.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  active
                    ? "bg-ns-tertiary text-white"
                    : "border border-dashed border-ns-alternate bg-ns-brand-light/40 text-ns-secondary hover:border-ns-primary"
                }`}
              >
                {f.label}
                <span className="ml-1 opacity-70">{f.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-ns-secondary">Aucun participant dans ce filtre.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((p) => {
            const status = rosterCanonicalStatus(p.status);
            const journey = resolveGuestJourneyStage(p);
            const interest = resolveInterestDisplay(p.email, interestByEmail);
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ns-alternate px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1">
                  {p.fullName ?? p.email}
                  {p.companyName ? ` · ${p.companyName}` : ""}
                  {p.phone ? (
                    <span className="mt-0.5 block text-xs text-ns-secondary">{p.phone}</span>
                  ) : (
                    <span className="mt-0.5 block text-xs text-ns-secondary">Pas de téléphone</span>
                  )}
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {interest ? (
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          interest === "oui"
                            ? "bg-emerald-50 text-emerald-800"
                            : interest === "non"
                              ? "bg-rose-50 text-rose-800"
                              : interest === "autre"
                                ? "bg-amber-50 text-amber-900"
                                : "bg-ns-brand-light text-ns-secondary"
                        }`}
                      >
                        {INTEREST_DISPLAY_LABELS[interest]}
                      </span>
                    ) : null}
                    <span className="text-[11px] font-medium text-ns-primary">{journey.label}</span>
                    {p.saveTheDateSentAt || p.calendarInviteSentAt || p.paymentRelanceSentAt ? (
                      <span className="text-[11px] text-ns-secondary">
                        {[
                          p.saveTheDateSentAt ? "STD" : null,
                          p.calendarInviteSentAt ? "Invite" : null,
                          p.paymentRelanceSentAt ? "Relance €" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {status === "waitlist" && onInviteFromWaitlist ? (
                    <button
                      type="button"
                      className={`${BTN_PRIMARY} px-2 py-1 text-xs`}
                      onClick={() => onInviteFromWaitlist(p.id)}
                      title="Passer en À payer et envoyer l’invitation calendrier"
                    >
                      INVITER
                    </button>
                  ) : null}
                  {onWhatsApp ? (
                    <button
                      type="button"
                      className="inline-flex h-7 items-center justify-center gap-1 rounded border border-ns-alternate bg-ns-surface px-1.5 text-ns-tertiary transition hover:border-ns-primary hover:bg-ns-brand-light"
                      onClick={() => onWhatsApp(p)}
                      title="WhatsApp"
                      aria-label="WhatsApp"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <select
                    value={status}
                    onChange={(e) =>
                      onStatusChange(p.id, e.target.value as EventParticipationStatus)
                    }
                    className="rounded border border-ns-alternate px-2 py-1 text-xs"
                  >
                    {(
                      [
                        "invited",
                        "attending",
                        "confirmed",
                        "comped",
                        "not_attending",
                        "waitlist",
                      ] as const
                    ).map((s) => (
                      <option key={s} value={s}>
                        {labels[s] ?? DEFAULT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
