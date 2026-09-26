"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { labelCityHubFr, labelPositionFr, labelSectorFr } from "@/lib/admin/waitlist-labels-fr";
import { labelEventFormat, type EventFormat } from "@/lib/constants/event-formats";
import { formatScore, type SatisfactionAverages } from "@/lib/admin/satisfaction-stats";
import {
  formatRegistrantDate,
} from "@/components/admin/registrant-table-cells";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type EventRow = {
  id: string;
  title: string;
  startsAt: string;
  status: string;
  capacity: number;
  guests: number;
  satisfaction: SatisfactionAverages & { sentCount: number };
};

type RecentRegistrant = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  city: string;
  position: string;
  sector: string;
  locale: string;
  source: string;
  createdAt: string;
  profileComplete: boolean | null;
  completionPercent: number;
  missingFields: string[];
  referredByCode: string | null;
  isExpress: boolean;
  welcomeEmailStatus: "sent" | "failed" | "skipped" | null;
  welcomeEmailSentAt: string | null;
  invitationsSent: number;
  eventsConfirmed: number;
  revenueMxn: number;
  referralsMade: number;
};

type RecentTableDraft = {
  id: string;
  title: string;
  city: string;
  format?: string;
  primaryCount: number;
  alternateCount: number;
  updatedAt: string;
};

type OpsQueueMember = {
  id: string;
  fullName: string;
  email: string;
  company: string;
  city: string;
  opsPriority: string;
  opsTags: string[];
  reason: string;
};

type OpsQueues = {
  incomplete: OpsQueueMember[];
  neverInvited: OpsQueueMember[];
  review: OpsQueueMember[];
  priority: OpsQueueMember[];
  noShow: OpsQueueMember[];
};

type NextEventRsvpYesGuest = {
  id: string;
  fullName: string;
  email: string;
  company: string;
  seat?: "oui" | "invite_sent" | "confirmed";
};

type NextEventRsvp = {
  eventId: string;
  eventSlug: string;
  title: string;
  startsAt: string;
  responseMode: "interest" | "rsvp";
  contacted: number;
  yes: number;
  no: number;
  other: number;
  pending: number;
  confirmed: number;
  inviteSent: number;
  sansReponseListName?: string;
  yesGuests: NextEventRsvpYesGuest[];
};

type LastEmailResults = {
  templateKey: string;
  templateLabel: string;
  sentAt: string;
  recipientCount: number;
  eventId: string | null;
  eventSlug: string | null;
  eventTitle: string | null;
  responseMode: "interest" | "rsvp" | "none";
  yes: number;
  no: number;
  other: number;
  pending: number;
  confirmed: number;
  inviteSent: number;
  registered: number;
  registeredExpress: number;
  registeredComplete: number;
  responseRate: number;
  yesRate: number;
  confirmedRate: number;
  sansReponseListName?: string;
  yesGuests: NextEventRsvpYesGuest[];
  noGuests: NextEventRsvpYesGuest[];
  recipients: EmailCampaignRecipient[];
  source: "cold_outreach" | "save_the_date" | "places_available" | "inferred";
};

type EmailCampaignRecipient = {
  id: string;
  email: string;
  fullName: string;
  company: string;
  outcome:
    | "confirmed"
    | "yes"
    | "invite_sent"
    | "no"
    | "other"
    | "registered"
    | "pending";
  signupKind?: "express" | "complete" | null;
};

type EmailCampaignHistoryRow = {
  id: string;
  templateKey: string;
  templateLabel: string;
  sentAt: string;
  recipientCount: number;
  yes: number;
  no: number;
  pending: number;
  confirmed: number;
  registered: number;
  responseRate: number;
  yesRate: number;
  confirmedRate: number;
  eventTitle: string | null;
  eventId: string | null;
};

type DistributionMember = {
  id: string;
  fullName: string;
  email: string;
  company: string;
};

type DistributionItem = {
  value: string;
  count: number;
  members?: DistributionMember[];
};

type DistributionSelection = {
  kind: "sector" | "position" | "city";
  value: string;
  members: DistributionMember[];
};

type DashboardPayload = {
  ok?: boolean;
  error?: string;
  kpis?: {
    waitlistUsers: number;
    eventsTotal: number;
    eventsPublished: number;
    eventsUpcoming: number;
    participationsTotal: number;
    confirmed: number;
    attending: number;
    invited: number;
    waitlistSeats: number;
    notAttending: number;
    surveysResponses: number;
    eventsWithSurvey: number;
    profilesNeedingAttention: number;
  };
  satisfaction?: SatisfactionAverages;
  events?: EventRow[];
  recentRegistrants?: RecentRegistrant[];
  distributions?: {
    sectors: DistributionItem[];
    positions: DistributionItem[];
    cities: DistributionItem[];
  };
  recentTableDrafts?: RecentTableDraft[];
  opsQueues?: OpsQueues;
  nextEventRsvp?: NextEventRsvp | null;
  lastEmailResults?: LastEmailResults | null;
  emailCampaignHistory?: EmailCampaignHistoryRow[];
};

const CATEGORIES: {
  key: keyof Pick<
    SatisfactionAverages,
    | "venueQuality"
    | "menuQuality"
    | "guestsQuality"
    | "valueForMoney"
    | "wouldReturn"
    | "wouldRecommend"
  >;
  label: string;
}[] = [
  { key: "venueQuality", label: "Endroit" },
  { key: "menuQuality", label: "Menu" },
  { key: "guestsQuality", label: "Sélection participants" },
  { key: "valueForMoney", label: "Qualité / prix" },
  { key: "wouldReturn", label: "Autres tables" },
  { key: "wouldRecommend", label: "En parlerait" },
];

function OpsQueueCard({
  title,
  href,
  rows,
}: {
  title: string;
  href: string;
  rows: OpsQueueMember[];
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-ns-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">{title}</p>
          <p className="mt-1 text-2xl font-black text-ns-tertiary">{rows.length}</p>
        </div>
        <Link href={href} className="text-xs font-semibold text-ns-primary hover:underline">
          Voir →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-ns-secondary">Aucune file pour l’instant.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 5).map((row) => (
            <li key={row.id}>
              <Link
                href={`/admin/personnes?tab=membres&id=${encodeURIComponent(row.id)}`}
                className="block rounded-lg px-2 py-1.5 hover:bg-ns-brand-light/60"
              >
                <span className="block truncate text-sm font-semibold text-ns-tertiary">
                  {row.fullName || row.email || "Sans nom"}
                </span>
                <span className="block truncate text-[11px] text-ns-secondary">
                  {row.reason}
                  {row.company ? ` · ${row.company}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatNextEventWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  });
}

function formatSentAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  });
}

function SeatBadge({ seat }: { seat?: NextEventRsvpYesGuest["seat"] }) {
  if (seat === "confirmed") {
    return (
      <span className="mt-1 inline-flex rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900">
        Payé
      </span>
    );
  }
  if (seat === "invite_sent") {
    return (
      <span className="mt-1 inline-flex rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900">
        Invité
      </span>
    );
  }
  return (
    <span className="mt-1 inline-flex rounded-full bg-emerald-100/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
      Oui
    </span>
  );
}

function YesGuestsList({
  yes,
  yesGuests,
}: {
  yes: number;
  yesGuests: NextEventRsvpYesGuest[];
}) {
  const confirmedCount = yesGuests.filter((g) => g.seat === "confirmed").length;
  return (
    <div className="mt-4 border-t border-gray-100/80 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
          Ont dit oui
        </p>
        <p className="text-[11px] text-ns-secondary">
          {confirmedCount} payé{confirmedCount === 1 ? "" : "s"}
          {yes > yesGuests.length
            ? ` · ${yesGuests.length} affichés · ${yes} au total`
            : yes > 0
              ? ` · ${yes} au total`
              : ""}
        </p>
      </div>
      {yesGuests.length === 0 ? (
        <p className="mt-2 text-sm text-ns-secondary">Aucun oui pour l’instant.</p>
      ) : (
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {yesGuests.map((g) => (
            <li
              key={g.id}
              className="rounded-lg border border-emerald-100/80 bg-white/70 px-2.5 py-1.5"
            >
              <span className="block truncate text-sm font-semibold text-ns-tertiary">
                {g.fullName || g.email || "Sans nom"}
              </span>
              <span className="block truncate text-[11px] text-ns-secondary">
                {g.company || g.email}
              </span>
              <SeatBadge seat={g.seat} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResponseCounters({
  contactedLabel,
  contacted,
  contactedHint,
  yes,
  confirmed,
  inviteSent,
  noTotal,
  noHint,
  pending,
  sansReponseListName,
}: {
  contactedLabel: string;
  contacted: number;
  contactedHint?: string;
  yes: number;
  confirmed: number;
  inviteSent: number;
  noTotal: number;
  noHint?: string;
  pending: number;
  sansReponseListName?: string;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ns-secondary">
          {contactedLabel}
        </p>
        <p className="mt-1 text-2xl font-black text-ns-tertiary">{contacted}</p>
        {contactedHint ? (
          <p className="text-[10px] text-ns-secondary">{contactedHint}</p>
        ) : null}
      </div>
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
          Oui
        </p>
        <p className="mt-1 text-2xl font-black text-emerald-900">{yes}</p>
        <p className="text-[10px] text-emerald-800/80">Intérêt STD</p>
      </div>
      <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-sky-900">
          Confirmés
        </p>
        <p className="mt-1 text-2xl font-black text-sky-950">{confirmed}</p>
        <p className="text-[10px] text-sky-900/80">
          {inviteSent > 0 ? `${inviteSent} invité·e·s en attente` : "Payés / places OK"}
        </p>
      </div>
      <div className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-rose-800">Non</p>
        <p className="mt-1 text-2xl font-black text-rose-900">{noTotal}</p>
        {noHint ? <p className="text-[10px] text-rose-800/80">{noHint}</p> : null}
      </div>
      <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900">
          Sans réponse
        </p>
        <p className="mt-1 text-2xl font-black text-amber-950">{pending}</p>
        {sansReponseListName ? (
          <Link
            href={`/admin/personnes?tab=prospects&list=${encodeURIComponent(sansReponseListName)}`}
            className="mt-1 block text-[10px] font-semibold text-amber-900/90 hover:underline"
          >
            Liste relance →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function LastEmailResultsCard({ results }: { results: LastEmailResults }) {
  const eventHref = results.eventId
    ? `/admin/evenements?id=${encodeURIComponent(results.eventId)}`
    : null;
  const noTotal = results.no + results.other;
  const isPlaces =
    results.templateKey.includes("places_available") ||
    results.source === "places_available";
  const modeHint =
    isPlaces || results.responseMode === "rsvp"
      ? "Boutons OUI / NON (RSVP)"
      : results.responseMode === "interest"
        ? "Save the Date / intérêt"
        : "Envoi tracké";

  return (
    <div className="rounded-2xl border border-ns-primary/25 bg-gradient-to-br from-ns-surface via-ns-surface to-ns-brand-light/50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ns-primary">
            Dernier email · {modeHint}
          </p>
          <h4 className="mt-1 text-lg font-black text-ns-tertiary sm:text-xl">
            {results.templateLabel || results.templateKey}
          </h4>
          <p className="mt-0.5 text-sm text-ns-secondary">
            Envoyé le {formatSentAt(results.sentAt)}
            {results.eventTitle ? ` · ${results.eventTitle}` : ""}
          </p>
          <p className="mt-1 max-w-2xl text-[11px] leading-snug text-ns-secondary">
            {results.recipientCount} mails envoyés · {results.responseRate}% de réponses ·{" "}
            {results.yes} OUI · {noTotal} NON · {results.registered} inscrits LA MESA (
            {results.registeredComplete} complet
            {results.registeredExpress > 0
              ? ` · ${results.registeredExpress} express`
              : ""}
            ).
          </p>
        </div>
        {eventHref ? (
          <Link
            href={eventHref}
            className="shrink-0 text-xs font-semibold text-ns-primary hover:underline"
          >
            Ouvrir l’événement →
          </Link>
        ) : (
          <Link
            href="/admin/templates"
            className="shrink-0 text-xs font-semibold text-ns-primary hover:underline"
          >
            Templates →
          </Link>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ns-secondary">
            Envoyés
          </p>
          <p className="mt-1 text-2xl font-black text-ns-tertiary">
            {results.recipientCount}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
            Oui
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-900">{results.yes}</p>
          <p className="text-[10px] text-emerald-800/80">{results.yesRate}%</p>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-rose-800">Non</p>
          <p className="mt-1 text-2xl font-black text-rose-900">{noTotal}</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-900">
            Confirmés
          </p>
          <p className="mt-1 text-2xl font-black text-sky-950">{results.confirmed}</p>
          <p className="text-[10px] text-sky-900/80">Payés</p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-900">
            Inscrits
          </p>
          <p className="mt-1 text-2xl font-black text-indigo-950">{results.registered}</p>
          <p className="text-[10px] text-indigo-900/80">
            {results.registeredComplete} complet
            {results.registeredExpress > 0
              ? ` · ${results.registeredExpress} express`
              : ""}
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900">
            Sans réponse
          </p>
          <p className="mt-1 text-2xl font-black text-amber-950">{results.pending}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <NamedGuestList
          title="Ont dit oui — à relancer pour le paiement"
          empty="Aucun OUI pour l’instant."
          guests={results.yesGuests}
          tone="yes"
        />
        <NamedGuestList
          title="Ont dit non"
          empty="Aucun NON pour l’instant."
          guests={results.noGuests}
          tone="no"
        />
      </div>

      <ContactedRecipientsList recipients={results.recipients} />
    </div>
  );
}

function NamedGuestList({
  title,
  empty,
  guests,
  tone,
}: {
  title: string;
  empty: string;
  guests: NextEventRsvpYesGuest[];
  tone: "yes" | "no";
}) {
  const border =
    tone === "yes" ? "border-emerald-100/80 bg-white/70" : "border-rose-100/80 bg-white/70";
  return (
    <div className="rounded-xl border border-gray-100 bg-white/50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">{title}</p>
      <p className="mt-0.5 text-[11px] text-ns-secondary">{guests.length} personne{guests.length === 1 ? "" : "s"}</p>
      {guests.length === 0 ? (
        <p className="mt-2 text-sm text-ns-secondary">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {guests.map((g) => (
            <li key={g.id} className={`rounded-lg border px-2.5 py-1.5 ${border}`}>
              <span className="block truncate text-sm font-semibold text-ns-tertiary">
                {g.fullName || g.email || "Sans nom"}
              </span>
              <span className="block truncate text-[11px] text-ns-secondary">
                {g.company || g.email}
              </span>
              {tone === "yes" && g.seat === "confirmed" ? (
                <span className="mt-1 inline-flex rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900">
                  Payé
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function outcomeLabel(outcome: EmailCampaignRecipient["outcome"]): string {
  switch (outcome) {
    case "confirmed":
      return "Payé";
    case "invite_sent":
      return "Invité";
    case "yes":
      return "Oui";
    case "no":
      return "Non";
    case "other":
      return "Autre";
    case "registered":
      return "Inscrit";
    default:
      return "Sans réponse";
  }
}

function outcomeClass(outcome: EmailCampaignRecipient["outcome"]): string {
  switch (outcome) {
    case "confirmed":
      return "bg-sky-100 text-sky-900";
    case "invite_sent":
      return "bg-violet-100 text-violet-900";
    case "yes":
      return "bg-emerald-100 text-emerald-900";
    case "no":
      return "bg-rose-100 text-rose-900";
    case "other":
      return "bg-orange-100 text-orange-900";
    case "registered":
      return "bg-indigo-100 text-indigo-900";
    default:
      return "bg-amber-100 text-amber-950";
  }
}

function ContactedRecipientsList({
  recipients,
}: {
  recipients: EmailCampaignRecipient[];
}) {
  const [expanded, setExpanded] = useState(false);
  const limit = expanded ? recipients.length : 12;
  const visible = recipients.slice(0, limit);
  const hidden = recipients.length - visible.length;

  return (
    <div className="mt-4 border-t border-gray-100/80 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
          Gens contactés · résultat
        </p>
        <p className="text-[11px] text-ns-secondary">
          {recipients.length} dans ce blast
        </p>
      </div>
      {recipients.length === 0 ? (
        <p className="mt-2 text-sm text-ns-secondary">
          Aucun destinataire enregistré pour ce blast.
        </p>
      ) : (
        <>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-gray-100 bg-white/70 px-2.5 py-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ns-tertiary">
                      {r.fullName || r.email || "Sans nom"}
                    </span>
                    <span className="block truncate text-[11px] text-ns-secondary">
                      {r.company || r.email}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${outcomeClass(r.outcome)}`}
                  >
                    {outcomeLabel(r.outcome)}
                  </span>
                </div>
                {r.signupKind ? (
                  <span className="mt-1 inline-flex rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-900">
                    {r.signupKind === "express" ? "Express" : "Profil complet"}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {hidden > 0 ? (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-ns-primary hover:underline"
              onClick={() => setExpanded(true)}
            >
              Voir les {hidden} autres →
            </button>
          ) : null}
          {expanded && recipients.length > 12 ? (
            <button
              type="button"
              className="mt-2 block text-xs text-ns-secondary hover:underline"
              onClick={() => setExpanded(false)}
            >
              Réduire
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

function EmailCampaignHistoryTable({ rows }: { rows: EmailCampaignHistoryRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
      <div className="mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
          Historique des envois
        </h3>
        <p className="mt-1 text-xs text-ns-secondary">
          Compare les taux pour voir quels mails convertissent le mieux.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-ns-secondary">
              <th className="py-2 pr-3 font-semibold">Email</th>
              <th className="py-2 pr-3 font-semibold">Date</th>
              <th className="py-2 pr-3 font-semibold">Envoyés</th>
              <th className="py-2 pr-3 font-semibold">OUI</th>
              <th className="py-2 pr-3 font-semibold">NON</th>
              <th className="py-2 pr-3 font-semibold">Confirmés</th>
              <th className="py-2 pr-3 font-semibold">Inscrits</th>
              <th className="py-2 font-semibold">Réponse</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-50 align-top">
                <td className="py-2.5 pr-3">
                  <p className="font-semibold text-ns-tertiary">{row.templateLabel}</p>
                  {row.eventTitle ? (
                    <p className="mt-0.5 text-[11px] text-ns-secondary">{row.eventTitle}</p>
                  ) : null}
                </td>
                <td className="py-2.5 pr-3 whitespace-nowrap text-ns-secondary">
                  {formatSentAt(row.sentAt)}
                </td>
                <td className="py-2.5 pr-3 font-semibold tabular-nums">{row.recipientCount}</td>
                <td className="py-2.5 pr-3 tabular-nums text-emerald-800">
                  {row.yes}
                  <span className="text-ns-secondary"> · {row.yesRate}%</span>
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-rose-800">{row.no}</td>
                <td className="py-2.5 pr-3 tabular-nums text-sky-900">
                  {row.confirmed}
                  <span className="text-ns-secondary"> · {row.confirmedRate}%</span>
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-indigo-900">{row.registered}</td>
                <td className="py-2.5 font-bold tabular-nums text-ns-tertiary">
                  {row.responseRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NextEventRsvpCard({ rsvp }: { rsvp: NextEventRsvp }) {
  const eventHref = `/admin/evenements?id=${encodeURIComponent(rsvp.eventId)}`;
  const noTotal = rsvp.no + rsvp.other;
  const modeHint =
    rsvp.responseMode === "interest"
      ? "Save the Date / intérêt"
      : "RSVP classique";

  return (
    <div className="rounded-2xl border border-ns-primary/25 bg-gradient-to-br from-ns-surface via-ns-surface to-ns-brand-light/50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ns-primary">
            Prochain événement · {modeHint}
          </p>
          <h4 className="mt-1 text-lg font-black text-ns-tertiary sm:text-xl">
            {rsvp.title}
          </h4>
          <p className="mt-0.5 text-sm capitalize text-ns-secondary">
            {formatNextEventWhen(rsvp.startsAt)}
          </p>
          {rsvp.responseMode === "interest" ? (
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-ns-secondary">
              OUI / NON = playlists CRM STD. Confirmés = places payées (pas seulement un
              oui). Contactés = mail STD + approches. Sans réponse = encore en jeu.
            </p>
          ) : null}
        </div>
        <Link
          href={eventHref}
          className="shrink-0 text-xs font-semibold text-ns-primary hover:underline"
        >
          Ouvrir l’événement →
        </Link>
      </div>

      <ResponseCounters
        contactedLabel="Contactés"
        contacted={rsvp.contacted}
        contactedHint="Mail STD + approches"
        yes={rsvp.yes}
        confirmed={rsvp.confirmed}
        inviteSent={rsvp.inviteSent}
        noTotal={noTotal}
        noHint={
          rsvp.other > 0
            ? `${rsvp.no} non · ${rsvp.other} autre`
            : "Formulaire + CRM Prospects"
        }
        pending={rsvp.pending}
        sansReponseListName={rsvp.sansReponseListName}
      />
      <YesGuestsList yes={rsvp.yes} yesGuests={rsvp.yesGuests} />
    </div>
  );
}

function CategoryBars({ sat }: { sat: SatisfactionAverages }) {
  return (
    <div className="space-y-3">
      {CATEGORIES.map((c) => {
        const score = sat[c.key];
        const pct = score === null ? 0 : Math.max(0, Math.min(100, (score / 5) * 100));
        return (
          <div key={c.key}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-ns-tertiary">{c.label}</span>
              <span className="font-bold text-ns-primary">{formatScore(score)} / 5</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-ns-brand-light">
              <div className="h-full rounded-full bg-[#b4e600]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function distributionLabel(kind: "sector" | "position" | "city", value: string): string {
  if (kind === "sector") return labelSectorFr(value);
  if (kind === "position") return labelPositionFr(value);
  if (kind === "city") return labelCityHubFr(value);
  return value;
}

function kindTitle(kind: "sector" | "position" | "city"): string {
  if (kind === "sector") return "Secteur";
  if (kind === "position") return "Position";
  return "Hub";
}

function DistributionDetailModal({
  selection,
  onClose,
}: {
  selection: DistributionSelection;
  onClose: () => void;
}) {
  const label = distributionLabel(selection.kind, selection.value);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${kindTitle(selection.kind)} : ${label}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
              {kindTitle(selection.kind)}
            </p>
            <h3 className="mt-1 text-lg font-bold text-ns-hero">{label}</h3>
            <p className="mt-1 text-xs text-ns-secondary">
              {selection.members.length} membre
              {selection.members.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 text-ns-secondary hover:text-ns-tertiary"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-2 py-2">
          {selection.members.length === 0 ? (
            <p className="px-3 py-4 text-sm text-ns-secondary">Aucun membre dans cette catégorie.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {selection.members.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/admin/personnes?tab=membres&id=${encodeURIComponent(m.id)}`}
                    className="block rounded-lg px-3 py-2.5 transition hover:bg-ns-brand-light/60"
                    onClick={onClose}
                  >
                    <span className="block truncate text-sm font-semibold text-ns-tertiary">
                      {m.fullName}
                    </span>
                    <span className="block truncate text-[11px] text-ns-secondary">
                      {[m.company, m.email].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function DistributionCard({
  title,
  items,
  total,
  kind,
  emptyLabel = "Aucune donnée.",
  onSelect,
}: {
  title: string;
  items: DistributionItem[];
  total: number;
  kind: "sector" | "position" | "city";
  emptyLabel?: string;
  onSelect: (item: DistributionItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const limit = kind === "city" ? items.length : expanded ? items.length : 8;
  const visible = items.slice(0, limit);
  const hiddenCount = items.length - visible.length;

  return (
    <div className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">{title}</h3>
        <span className="text-xs font-semibold text-ns-secondary">{total} membres</span>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-ns-secondary">{emptyLabel}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((item) => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            const muted = kind === "city" && item.count === 0;
            const clickable = item.count > 0;
            return (
              <button
                key={item.value}
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (clickable) onSelect(item);
                }}
                className={`w-full rounded-lg text-left transition ${
                  muted
                    ? "cursor-default opacity-45"
                    : "cursor-pointer hover:bg-ns-brand-light/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-primary"
                }`}
                aria-label={`Voir les membres : ${distributionLabel(kind, item.value)}`}
              >
                <div className="mb-1 flex items-baseline justify-between gap-3 px-1 pt-1 text-xs">
                  <span className="min-w-0 truncate font-medium text-ns-tertiary">
                    {distributionLabel(kind, item.value)}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-ns-primary">
                    {item.count} · {pct}%
                  </span>
                </div>
                <div className="mx-1 mb-1 h-2 overflow-hidden rounded-full bg-ns-brand-light">
                  <div className="h-full rounded-full bg-[#b4e600]" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
          {hiddenCount > 0 ? (
            <button
              type="button"
              className="text-xs font-semibold text-ns-primary hover:underline"
              onClick={() => setExpanded(true)}
            >
              +{hiddenCount} autre{hiddenCount > 1 ? "s" : ""}
            </button>
          ) : null}
          {expanded && kind !== "city" && items.length > 8 ? (
            <button
              type="button"
              className="text-xs text-ns-secondary hover:underline"
              onClick={() => setExpanded(false)}
            >
              Réduire
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FunnelStage({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <p
        className={`text-2xl font-black tabular-nums ${
          emphasize ? "text-ns-primary" : "text-ns-tertiary"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-ns-secondary">{label}</p>
    </div>
  );
}

function FunnelArrow() {
  return (
    <span
      className="hidden shrink-0 self-center text-ns-secondary/40 sm:inline"
      aria-hidden
    >
      →
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Chargement du dashboard">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-36 animate-pulse rounded-lg bg-ns-brand-light" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-ns-brand-light" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-full bg-ns-brand-light" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-ns-surface p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-ns-brand-light" />
            <div className="mt-3 h-9 w-16 animate-pulse rounded bg-ns-brand-light" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-100 bg-ns-surface p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-ns-brand-light" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-ns-brand-light/70" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardPanel() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distributionSelection, setDistributionSelection] =
    useState<DistributionSelection | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/dashboard");
      const json = (await res.json()) as DashboardPayload & {
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok) {
        const code = json.error ?? "load_failed";
        if (code === "firestore_quota_exceeded" || /quota|RESOURCE_EXHAUSTED/i.test(json.detail ?? "")) {
          throw new Error(
            "Quota Firestore dépassé (trop de lectures sur le dashboard). Réessaie dans 1–2 min, ou passe le projet Firebase en Blaze / augmente le quota.",
          );
        }
        throw new Error(json.detail ? `${code}: ${json.detail}` : code);
      }
      setData(json);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(
        raw === "firestore_quota_exceeded" || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(raw)
          ? "Quota Firestore dépassé (trop de lectures sur le dashboard). Réessaie dans 1–2 min, ou passe le projet Firebase en Blaze / augmente le quota."
          : raw,
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <DashboardSkeleton />;
  if (error) {
    return (
      <div className="space-y-3">
        <p className={ERROR_TEXT}>{error}</p>
        <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
          Réessayer
        </button>
      </div>
    );
  }
  if (!data?.kpis || !data.satisfaction) return null;

  const {
    kpis,
    satisfaction,
    events = [],
    recentRegistrants = [],
    distributions,
    recentTableDrafts = [],
    opsQueues,
    nextEventRsvp = null,
    lastEmailResults = null,
    emailCampaignHistory = [],
  } = data;
  const withScores = events.filter((e) => e.satisfaction.responseCount > 0);
  const avgCompletion =
    recentRegistrants.length === 0
      ? null
      : Math.round(
          recentRegistrants.reduce((sum, r) => sum + r.completionPercent, 0) /
            recentRegistrants.length,
        );
  const needingAttention = kpis.profilesNeedingAttention ?? 0;
  const queues: OpsQueues = opsQueues ?? {
    incomplete: [],
    neverInvited: [],
    review: [],
    priority: [],
    noShow: [],
  };

  const nba = (() => {
    if (nextEventRsvp) {
      return {
        id: "continue_dinner",
        label: "Continuer le dîner",
        href: `/admin/evenements?id=${encodeURIComponent(nextEventRsvp.eventId)}`,
        reason: `${nextEventRsvp.title} — reprendre le pilotage par phase.`,
      };
    }
    if (queues.incomplete.length > 0) {
      return {
        id: "incomplete",
        label: `Traiter ${queues.incomplete.length} profil${queues.incomplete.length > 1 ? "s" : ""} incomplet${queues.incomplete.length > 1 ? "s" : ""}`,
        href: "/admin/personnes?tab=membres&profile=incomplete",
        reason: "Nurture avant d’inviter — express ou complétion < 50 %.",
      };
    }
    if (queues.priority.length > 0) {
      return {
        id: "priority",
        label: `Voir ${queues.priority.length} à prioriser`,
        href: "/admin/personnes?tab=membres&queue=priority",
        reason: "Contacts marqués prioritaires sur la waitlist.",
      };
    }
    if (queues.review.length > 0) {
      return {
        id: "review",
        label: `Voir ${queues.review.length} à revoir`,
        href: "/admin/personnes?tab=membres&queue=review",
        reason: "Contacts à clarifier avant la prochaine vague.",
      };
    }
    if (queues.noShow.length > 0) {
      return {
        id: "no_show",
        label: `Voir ${queues.noShow.length} no-show`,
        href: "/admin/personnes?tab=membres&queue=no-show",
        reason: "Tag no-show — décider avant une prochaine invite.",
      };
    }
    return {
      id: "new_event",
      label: "Nouvel événement",
      href: "/admin/evenements?nouveau=1",
      reason: "Aucun dîner à venir — créer le prochain.",
    };
  })();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ns-hero">Dashboard</h2>
          <p className="mt-1 text-sm text-ns-secondary">
            Porte d’entrée ops — une action prioritaire, puis les hubs.
          </p>
          <p className="mt-2 text-sm text-ns-tertiary">
            <span className="font-semibold">Action prioritaire :</span>{" "}
            <span className="text-ns-secondary">{nba.reason}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${BTN_SECONDARY} text-sm`} onClick={() => void load()}>
            Rafraîchir
          </button>
          {nba.id !== "new_event" ? (
            <Link href="/admin/evenements?nouveau=1" className={`${BTN_SECONDARY} text-sm`}>
              Nouvel événement
            </Link>
          ) : null}
          <Link href={nba.href} className={`${BTN_PRIMARY} text-sm`}>
            {nba.label}
          </Link>
        </div>
      </div>

      {/* Bande 1 — Maintenant */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
            Maintenant
          </h3>
          <p className="mt-1 text-xs text-ns-secondary">
            Le dîner en cours et l’action prioritaire.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {nextEventRsvp ? (
            <NextEventRsvpCard rsvp={nextEventRsvp} />
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-ns-surface/60 p-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
                Prochain événement
              </p>
              <p className="mt-2 text-sm text-ns-secondary">
                Aucun événement à venir — crée-en un pour suivre les RSVP ici.
              </p>
              <Link
                href="/admin/evenements?nouveau=1"
                className="mt-3 inline-block text-xs font-semibold text-ns-primary hover:underline"
              >
                Nouvel événement →
              </Link>
            </div>
          )}
          {lastEmailResults ? (
            <LastEmailResultsCard results={lastEmailResults} />
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-ns-surface/60 p-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
                Dernier email
              </p>
              <p className="mt-2 text-sm text-ns-secondary">
                Aucun envoi tracké — lance un STD ou une campagne depuis Coms / Personnes.
              </p>
              <Link
                href="/admin/personnes?tab=prospects"
                className="mt-3 inline-block text-xs font-semibold text-ns-primary hover:underline"
              >
                Personnes · Prospects →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Bande 2 — À traiter */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
            À traiter
          </h3>
          <p className="mt-1 text-xs text-ns-secondary">
            Files prioritaires — un clic vers Personnes.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OpsQueueCard
            title="Profils incomplets"
            href="/admin/personnes?tab=membres&profile=incomplete"
            rows={queues.incomplete}
          />
          <OpsQueueCard
            title="À prioriser"
            href="/admin/personnes?tab=membres&queue=priority"
            rows={queues.priority}
          />
          <OpsQueueCard
            title="À revoir"
            href="/admin/personnes?tab=membres&queue=review"
            rows={queues.review}
          />
          <OpsQueueCard
            title="No-show"
            href="/admin/personnes?tab=membres&queue=no-show"
            rows={queues.noShow}
          />
        </div>
        {needingAttention > 0 ? (
          <Link
            href="/admin/personnes?tab=membres&profile=incomplete"
            className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 transition hover:border-amber-300 hover:bg-amber-100/80"
          >
            <div>
              <p className="text-sm font-bold text-amber-950">
                {needingAttention} profil{needingAttention > 1 ? "s" : ""} à compléter
              </p>
              <p className="mt-0.5 text-xs text-amber-900/80">
                Express ou complétion &lt; 50 % — prioriser le nurture avant d’inviter.
              </p>
            </div>
            <span className="text-xs font-semibold text-amber-900">Ouvrir Personnes →</span>
          </Link>
        ) : null}
      </section>

      {/* Bande 3 — Accès */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
            Accès
          </h3>
          <p className="mt-1 text-xs text-ns-secondary">
            Les hubs du backend — tout part d’ici.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/evenements"
            className="rounded-2xl border border-gray-100 bg-ns-surface p-4 transition hover:border-ns-primary/40 hover:bg-ns-brand-light/40"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">Dîners</p>
            <p className="mt-1 text-lg font-bold text-ns-hero">
              {kpis.eventsUpcoming} à venir
            </p>
            <p className="mt-1 text-xs text-ns-secondary">
              {kpis.eventsPublished} publiés · pilotage par phase
            </p>
          </Link>
          <Link
            href="/admin/personnes"
            className="rounded-2xl border border-gray-100 bg-ns-surface p-4 transition hover:border-ns-primary/40 hover:bg-ns-brand-light/40"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
              Personnes
            </p>
            <p className="mt-1 text-lg font-bold text-ns-hero">{kpis.waitlistUsers}</p>
            <p className="mt-1 text-xs text-ns-secondary">Membres · Prospects · Mémoire</p>
          </Link>
          <Link
            href="/admin/templates"
            className="rounded-2xl border border-gray-100 bg-ns-surface p-4 transition hover:border-ns-primary/40 hover:bg-ns-brand-light/40"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">Coms</p>
            <p className="mt-1 text-lg font-bold text-ns-hero">
              {emailCampaignHistory.length > 0
                ? `${emailCampaignHistory.length} envoi${emailCampaignHistory.length > 1 ? "s" : ""}`
                : "Templates"}
            </p>
            <p className="mt-1 text-xs text-ns-secondary">Bibliothèque · blasts · nurture</p>
          </Link>
          <Link
            href="/admin/tables"
            className="rounded-2xl border border-gray-100 bg-ns-surface p-4 transition hover:border-ns-primary/40 hover:bg-ns-brand-light/40"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">Tables</p>
            <p className="mt-1 text-lg font-bold text-ns-hero">{recentTableDrafts.length}</p>
            <p className="mt-1 text-xs text-ns-secondary">Brouillons récents · composition</p>
          </Link>
        </div>
      </section>

      {/* Approfondir — densifié sous la porte */}
      <section className="space-y-4 border-t border-gray-100 pt-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
            Approfondir
          </h3>
          <p className="mt-1 text-xs text-ns-secondary">
            Signaux utiles — sans concurrencer l’action prioritaire ci-dessus.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-ns-surface p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
              Funnel participations
            </h4>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-2 sm:flex-nowrap">
              <FunnelStage label="Invités" value={kpis.invited} />
              <FunnelArrow />
              <FunnelStage label="Confirmés" value={kpis.confirmed} emphasize />
              <FunnelArrow />
              <FunnelStage label="Présents" value={kpis.attending} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-gray-100 pt-3 text-xs sm:grid-cols-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-ns-secondary">Déclinés</span>
                <span className="font-semibold tabular-nums text-ns-tertiary">
                  {kpis.notAttending}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-ns-secondary">Waitlist</span>
                <span className="font-semibold tabular-nums text-ns-tertiary">
                  {kpis.waitlistSeats}
                </span>
              </div>
              <div className="col-span-2 flex items-baseline justify-between gap-2 sm:col-span-1">
                <span className="text-ns-secondary">En parlerait</span>
                <span className="font-semibold tabular-nums text-ns-tertiary">
                  {satisfaction.wouldRecommend === null
                    ? "—"
                    : `${formatScore(satisfaction.wouldRecommend)}/5`}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-ns-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
                Satisfaction cumulée
              </h4>
              <span className="text-[11px] text-ns-secondary">
                {kpis.surveysResponses} réponses · {kpis.eventsWithSurvey} dîners
              </span>
            </div>
            {satisfaction.responseCount === 0 ? (
              <p className="mt-3 text-sm text-ns-secondary">Pas encore de réponses survey.</p>
            ) : (
              <div className="mt-3">
                <p className="mb-3 text-3xl font-black text-ns-tertiary">
                  {formatScore(satisfaction.overall)}
                  <span className="text-base text-ns-secondary"> / 5</span>
                </p>
                <CategoryBars sat={satisfaction} />
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-ns-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
                  Vivier · tables
                </h4>
                <p className="mt-0.5 text-[11px] text-ns-secondary">
                  Derniers brouillons Table Builder
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin/tables" className={`${BTN_SECONDARY} text-xs`}>
                  Tables
                </Link>
                <Link href="/admin/tables?generate=1" className={`${BTN_SECONDARY} text-xs`}>
                  Générer
                </Link>
              </div>
            </div>
            {recentTableDrafts.length === 0 ? (
              <p className="mt-3 text-sm text-ns-secondary">Aucun brouillon.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recentTableDrafts.slice(0, 3).map((draft) => (
                  <li
                    key={draft.id}
                    className="rounded-xl border border-gray-100 bg-ns-brand-light/40 px-3 py-2"
                  >
                    <p className="truncate text-sm font-semibold text-ns-tertiary">
                      {draft.title || "Table sans titre"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ns-secondary">
                      {labelEventFormat(draft.format as EventFormat | undefined, "fr")}
                      {" · "}
                      {draft.primaryCount} tit. · {draft.alternateCount} supp.
                      {" · "}
                      {formatRegistrantDate(draft.updatedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-ns-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
                  Derniers inscrits
                </h4>
                <p className="mt-0.5 text-[11px] text-ns-secondary">
                  {avgCompletion !== null ? `Complétion moy. ${avgCompletion}%` : "Plus récents"}
                </p>
              </div>
              <Link
                href="/admin/personnes?tab=membres"
                className="text-xs font-semibold text-ns-primary hover:underline"
              >
                Tous →
              </Link>
            </div>
            {recentRegistrants.length === 0 ? (
              <p className="mt-3 text-sm text-ns-secondary">Aucun inscrit.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-50">
                {recentRegistrants.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-2 px-1 py-2 text-left hover:bg-ns-brand-light/50"
                      onClick={() =>
                        router.push(
                          `/admin/personnes?tab=membres&id=${encodeURIComponent(r.id)}`,
                        )
                      }
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ns-tertiary">
                          {r.fullName || "—"}
                        </span>
                        <span className="block truncate text-[11px] text-ns-secondary">
                          {r.email}
                          {r.isExpress ? " · Express" : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-ns-secondary">
                        {r.completionPercent}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
            Répartition waitlist
          </h4>
          <div className="grid gap-3 lg:grid-cols-3">
            <DistributionCard
              title="Secteurs"
              items={distributions?.sectors ?? []}
              total={kpis.waitlistUsers}
              kind="sector"
              onSelect={(item) =>
                setDistributionSelection({
                  kind: "sector",
                  value: item.value,
                  members: item.members ?? [],
                })
              }
            />
            <DistributionCard
              title="Positions"
              items={distributions?.positions ?? []}
              total={kpis.waitlistUsers}
              kind="position"
              onSelect={(item) =>
                setDistributionSelection({
                  kind: "position",
                  value: item.value,
                  members: item.members ?? [],
                })
              }
            />
            <DistributionCard
              title="Hubs"
              items={distributions?.cities ?? []}
              total={kpis.waitlistUsers}
              kind="city"
              onSelect={(item) =>
                setDistributionSelection({
                  kind: "city",
                  value: item.value,
                  members: item.members ?? [],
                })
              }
            />
          </div>
        </div>

        {distributionSelection ? (
          <DistributionDetailModal
            selection={distributionSelection}
            onClose={() => setDistributionSelection(null)}
          />
        ) : null}

        <div>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
            Historique emails
          </h4>
          <EmailCampaignHistoryTable rows={emailCampaignHistory} />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-ns-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-ns-secondary">
              Satisfaction par dîner
            </h4>
            <p className="text-[11px] text-ns-secondary">
              {withScores.length} avec réponses
            </p>
          </div>

          {events.length === 0 ? (
            <p className="mt-3 text-sm text-ns-secondary">Aucun événement.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-ns-secondary">
                    <th className="py-2 pr-3 font-semibold">Dîner</th>
                    <th className="py-2 pr-3 font-semibold">Date</th>
                    <th className="py-2 pr-3 font-semibold">Réponses</th>
                    <th className="py-2 pr-3 font-semibold">Moy.</th>
                    <th className="py-2 pr-3 font-semibold">Lieu</th>
                    <th className="py-2 pr-3 font-semibold">Menu</th>
                    <th className="py-2 pr-3 font-semibold">Sélection</th>
                    <th className="py-2 pr-3 font-semibold">Q/P</th>
                    <th className="py-2 pr-3 font-semibold">Tables</th>
                    <th className="py-2 font-semibold">Bouche</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => {
                    const s = ev.satisfaction;
                    const date = new Date(ev.startsAt);
                    return (
                      <tr key={ev.id} className="border-b border-gray-50">
                        <td className="py-2.5 pr-3">
                          <Link
                            href={`/admin/evenements?id=${encodeURIComponent(ev.id)}`}
                            className="font-semibold text-ns-primary hover:underline"
                          >
                            {ev.title}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3 text-ns-secondary">
                          {Number.isNaN(date.getTime())
                            ? "—"
                            : date.toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                        </td>
                        <td className="py-2.5 pr-3">
                          {s.responseCount}
                          <span className="text-ns-secondary">/{s.sentCount}</span>
                        </td>
                        <td className="py-2.5 pr-3 font-bold text-ns-tertiary">
                          {formatScore(s.overall)}
                        </td>
                        <td className="py-2.5 pr-3">{formatScore(s.venueQuality)}</td>
                        <td className="py-2.5 pr-3">{formatScore(s.menuQuality)}</td>
                        <td className="py-2.5 pr-3">{formatScore(s.guestsQuality)}</td>
                        <td className="py-2.5 pr-3">{formatScore(s.valueForMoney)}</td>
                        <td className="py-2.5 pr-3">{formatScore(s.wouldReturn)}</td>
                        <td className="py-2.5">{formatScore(s.wouldRecommend)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
