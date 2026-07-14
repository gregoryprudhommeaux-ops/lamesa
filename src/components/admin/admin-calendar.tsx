"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { countSeatedParticipations, DEFAULT_GUEST_CAPACITY } from "@/lib/events/capacity";
import type { AdminEvent, AdminEventParticipation } from "@/lib/types/events";
import { BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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

function formatMonthTitle(d: Date) {
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

type DayCell = {
  date: Date;
  inMonth: boolean;
};

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

export function AdminCalendarPanel({ title }: { title: string }) {
  const authFetch = useAuthFetch();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [participations, setParticipations] = useState<AdminEventParticipation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
      setEvents(json.events ?? []);
      setParticipations(json.participations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const filledByEvent = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      const parts = participations.filter((p) => p.eventId === ev.id);
      map.set(ev.id, countSeatedParticipations(parts));
    }
    return map;
  }, [events, participations]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, AdminEvent[]>();
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

  const monthEvents = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    return events
      .filter((ev) => {
        const d = new Date(ev.startsAt);
        return d.getFullYear() === y && d.getMonth() === m;
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [events, cursor]);

  const cells = useMemo(() => buildGrid(cursor), [cursor]);
  const today = new Date();

  if (loading) return <p className="text-sm text-ns-secondary">Chargement…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ns-hero">{title}</h2>
          <p className="mt-1 text-sm text-ns-secondary">
            Vue mensuelle — places = invités / présents sur capacité.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`${BTN_SECONDARY} inline-flex items-center gap-1 px-3 py-2`}
            onClick={() => setCursor((c) => addMonths(c, -1))}
            aria-label="Mois précédent"
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
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && <p className={ERROR_TEXT}>{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-ns-surface">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-ns-brand-light/60">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-ns-secondary"
            >
              {d}
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
                  {dayEvents.map((ev) => {
                    const cap = ev.capacity ?? DEFAULT_GUEST_CAPACITY;
                    const filled = filledByEvent.get(ev.id) ?? 0;
                    return (
                      <li key={ev.id}>
                        <Link
                          href={`/admin/evenements?id=${encodeURIComponent(ev.id)}`}
                          className="block rounded-lg border border-ns-primary/20 bg-ns-primary/10 px-1.5 py-1 text-left transition hover:bg-ns-primary/20"
                          title={ev.title}
                        >
                          <p className="truncate text-[11px] font-bold leading-tight text-ns-tertiary">
                            {ev.title}
                          </p>
                          <p className="truncate text-[10px] text-ns-secondary">
                            {formatTime(ev.startsAt)}
                            {ev.venueName ? ` · ${ev.venueName}` : ""}
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold text-ns-primary">
                            {filled}/{cap}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ns-secondary">
          Dîners du mois ({monthEvents.length})
        </h3>
        {monthEvents.length === 0 ? (
          <p className="text-sm text-ns-secondary">Aucun événement ce mois-ci.</p>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-ns-surface">
            {monthEvents.map((ev) => {
              const cap = ev.capacity ?? DEFAULT_GUEST_CAPACITY;
              const filled = filledByEvent.get(ev.id) ?? 0;
              const d = new Date(ev.startsAt);
              return (
                <li key={ev.id}>
                  <Link
                    href={`/admin/evenements?id=${encodeURIComponent(ev.id)}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-ns-brand-light/50"
                  >
                    <div>
                      <p className="font-semibold text-ns-tertiary">{ev.title}</p>
                      <p className="text-sm text-ns-secondary">
                        {d.toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        · {formatTime(ev.startsAt)}
                        {ev.venueName ? ` · ${ev.venueName}` : ""}
                        {!ev.venueName && ev.address ? ` · ${ev.address}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-ns-primary">
                        {filled}/{cap} places
                      </p>
                      <p className="text-xs text-ns-secondary">
                        {labelsStatus(ev.status)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function labelsStatus(status?: string) {
  if (status === "published") return "Publié";
  if (status === "closed") return "Clôturé";
  return "Brouillon";
}
