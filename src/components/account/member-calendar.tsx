"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Link } from "@/i18n/navigation";
import { BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

type CalendarFellow = { fullName?: string; companyName?: string; status: "present" };

type CalendarEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  venueName?: string;
  address?: string;
  mapsUrl?: string;
  invited: boolean;
  participationStatus?: string;
  fellows?: CalendarFellow[];
};

type DayCell = {
  date: Date;
  inMonth: boolean;
};

// Copied from admin-calendar.tsx month-grid helpers (not imported — member
// calendar must stay decoupled from the admin panel).
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildGrid(month: Date): DayCell[] {
  const first = startOfMonth(month);
  // Monday = 0 … Sunday = 6
  const mondayIndex = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayIndex);

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push({
      date,
      inMonth: date.getMonth() === month.getMonth(),
    });
  }
  return cells;
}

function EventDetailPanel({
  event,
  locale,
  onClose,
  t,
}: {
  event: CalendarEvent;
  locale: string;
  onClose: () => void;
  t: ReturnType<typeof useTranslations<"account">>;
}) {
  const fellows = event.fellows ?? [];
  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-ns-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-ns-tertiary">{event.title}</h4>
          <p className="mt-1 text-sm text-ns-secondary">
            {new Date(event.startsAt).toLocaleString(locale)}
            {event.venueName ? ` · ${event.venueName}` : ""}
          </p>
          {event.address && <p className="text-sm text-ns-secondary">{event.address}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("calendar.close")}
          className="rounded-full p-1 text-ns-secondary hover:bg-ns-brand-light/60 hover:text-ns-tertiary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {fellows.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ns-secondary">
            {t("fellows")}
          </p>
          <p className="mt-1 text-sm text-ns-tertiary">
            {fellows
              .map((f) => [f.fullName ?? t("guest"), f.companyName].filter(Boolean).join(" · "))
              .join(", ")}
          </p>
        </div>
      )}

      <Link
        href={`/e/${event.slug}`}
        className="inline-block text-sm font-semibold text-ns-primary hover:underline"
      >
        {t("viewEvent")}
      </Link>
    </div>
  );
}

export function MemberCalendar() {
  const t = useTranslations("account");
  const locale = useLocale();
  const authFetch = useAuthFetch();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/me/calendar");
      const json = (await res.json()) as {
        ok?: boolean;
        events?: CalendarEvent[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "error");
        return;
      }
      setEvents(json.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const weekdayLabels = useMemo(() => {
    // 2024-01-01 was a Monday — used purely as a reference week.
    const base = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: "short" });
    });
  }, [locale]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.startsAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [events]);

  const cells = useMemo(() => buildGrid(cursor), [cursor]);
  const today = new Date();

  function formatMonthTitle(d: Date) {
    return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
  }

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  if (loading) return <p className="text-sm text-ns-secondary">{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`${BTN_SECONDARY} inline-flex items-center gap-1 px-3 py-2`}
            onClick={() => setCursor((c) => addMonths(c, -1))}
            aria-label={t("calendar.prevMonth")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`${BTN_SECONDARY} px-3 py-2 capitalize`}
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            {formatMonthTitle(cursor)}
          </button>
          <button
            type="button"
            className={`${BTN_SECONDARY} inline-flex items-center gap-1 px-3 py-2`}
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label={t("calendar.nextMonth")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-ns-secondary">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-ns-primary/70" />
            {t("calendar.legendInvited")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
            {t("calendar.legendNotInvited")}
          </span>
        </div>
      </div>

      {error && <p className={ERROR_TEXT}>{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-ns-surface">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-ns-brand-light/60">
          {weekdayLabels.map((label, i) => (
            <div
              key={`${label}-${i}`}
              className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-ns-secondary"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = sameDay(cell.date, today);
            return (
              <div
                key={key + String(cell.inMonth)}
                className={`min-h-[110px] border-b border-r border-gray-50 p-1.5 last:border-r-0 ${
                  cell.inMonth ? "bg-white" : "bg-ns-brand-light/30"
                }`}
              >
                <div
                  className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday
                      ? "bg-ns-primary text-ns-hero"
                      : cell.inMonth
                        ? "text-ns-tertiary"
                        : "text-ns-secondary/50"
                  }`}
                >
                  {cell.date.getDate()}
                </div>
                <ul className="space-y-1">
                  {dayEvents.map((ev) =>
                    ev.invited ? (
                      <li key={ev.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(ev)}
                          className="block w-full rounded-lg border border-ns-primary/20 bg-ns-primary/10 px-1.5 py-1 text-left transition hover:bg-ns-primary/20"
                          title={ev.title}
                        >
                          <p className="truncate text-[11px] font-bold leading-tight text-ns-tertiary">
                            {ev.title}
                          </p>
                          <p className="truncate text-[10px] text-ns-secondary">
                            {formatTime(ev.startsAt)}
                          </p>
                        </button>
                      </li>
                    ) : (
                      <li key={ev.id}>
                        <div
                          className="block w-full cursor-not-allowed rounded-lg border border-gray-100 bg-gray-50 px-1.5 py-1 text-left opacity-70"
                          title={t("calendar.invitationRequired")}
                          aria-label={t("calendar.invitationRequired")}
                        >
                          <p className="truncate text-[11px] font-semibold leading-tight text-ns-secondary">
                            {ev.title}
                          </p>
                          <p className="truncate text-[10px] text-ns-secondary">
                            {formatTime(ev.startsAt)}
                          </p>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {events.length === 0 && (
        <p className="text-sm text-ns-secondary">{t("calendar.empty")}</p>
      )}

      {selected && (
        <EventDetailPanel event={selected} locale={locale} onClose={() => setSelected(null)} t={t} />
      )}
    </div>
  );
}
