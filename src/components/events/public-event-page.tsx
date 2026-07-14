"use client";

import { LaMesaShell } from "@/components/la-mesa-shell";
import {
  BTN_PRIMARY,
  ERROR_TEXT,
  FORM_SECTION_TITLE,
  INPUT_CLASS,
  LABEL_CLASS,
  PAGE_TITLE,
} from "@/lib/ui/nextstep";
import type { AdminEvent } from "@/lib/types/events";
import { fmtDateTime } from "@/lib/events/utils";
import { computeEventIva, formatMxn } from "@/lib/events/pricing";
import { getClientFirestore, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { addDoc, collection, getDocs, limit, query, where } from "firebase/firestore";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type PublicEventPageProps = {
  slug: string;
  locale: "fr" | "en" | "es";
};

function PriceBlock({
  priceMxn,
  locale,
}: {
  priceMxn: number;
  locale: "fr" | "en" | "es";
}) {
  const t = useTranslations("publicEvent");
  const { priceBeforeTax, iva, totalWithIva } = computeEventIva(priceMxn);
  return (
    <div className="mt-4 rounded-xl border border-ns-alternate bg-ns-brand-light/30 px-4 py-3 text-sm">
      <p className="font-semibold text-ns-tertiary">
        {t("price")} · {formatMxn(priceBeforeTax, locale)}
      </p>
      <p className="mt-1 text-xs text-ns-secondary">
        {t("iva")}: {formatMxn(iva, locale)} · {t("totalWithIva")}:{" "}
        <strong>{formatMxn(totalWithIva, locale)}</strong>
      </p>
    </div>
  );
}

export function PublicEventPage({ slug, locale }: PublicEventPageProps) {
  const t = useTranslations("publicEvent");
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      if (!isFirebaseClientConfigured()) {
        setError("Firebase not configured");
        setLoading(false);
        return;
      }
      try {
        const db = getClientFirestore();
        const snap = await getDocs(
          query(
            collection(db, "events"),
            where("slug", "==", slug),
            where("status", "==", "published"),
            limit(1),
          ),
        );
        const docSnap = snap.docs[0];
        if (!docSnap) {
          setEvent(null);
          return;
        }
        const data = docSnap.data() as Record<string, unknown>;
        setEvent({
          id: docSnap.id,
          slug: String(data.slug ?? slug),
          title: String(data.title ?? ""),
          organizerName: data.organizerName ? String(data.organizerName) : undefined,
          introText: data.introText ? String(data.introText) : undefined,
          venueName: data.venueName ? String(data.venueName) : undefined,
          address: data.address ? String(data.address) : undefined,
          mapsUrl: data.mapsUrl ? String(data.mapsUrl) : undefined,
          startsAt: String(data.startsAt ?? ""),
          endsAt: data.endsAt ? String(data.endsAt) : undefined,
          capacity: typeof data.capacity === "number" ? data.capacity : undefined,
          priceMxn: typeof data.priceMxn === "number" ? data.priceMxn : undefined,
          menuIncluded: data.menuIncluded ? String(data.menuIncluded) : undefined,
          status: "published",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [slug]);

  async function submitGuest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!event?.id || submitting) return;
    setSubmitting(true);
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const db = getClientFirestore();
      await addDoc(collection(db, "event_respondents"), {
        eventId: event.id,
        firstName: String(data.get("firstName") ?? "").trim(),
        lastName: String(data.get("lastName") ?? "").trim(),
        email: String(data.get("email") ?? "").trim().toLowerCase(),
        whatsapp: String(data.get("whatsapp") ?? "").trim(),
        jobTitle: String(data.get("jobTitle") ?? "").trim(),
        companyName: String(data.get("companyName") ?? "").trim(),
        comments: String(data.get("comments") ?? "").trim(),
        attendance: "yes",
        createdAt: new Date().toISOString(),
      });
      setSuccess(true);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <LaMesaShell>
        <p className="text-center text-sm text-white/70">{t("loading")}</p>
      </LaMesaShell>
    );
  }

  if (!event) {
    return (
      <LaMesaShell>
        <p className="text-center text-sm text-white/70">{t("notFound")}</p>
      </LaMesaShell>
    );
  }

  return (
    <LaMesaShell card cardClassName="max-w-xl">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-ns-primary">LA MESA</p>
      <h1 className={`${PAGE_TITLE} mt-2 text-ns-hero`}>{event.title}</h1>
      <p className="mt-2 text-sm text-ns-secondary">
        {fmtDateTime(event.startsAt, locale)}
        {event.endsAt ? ` → ${fmtDateTime(event.endsAt, locale)}` : ""}
      </p>
      {event.venueName && (
        <p className="mt-2 text-sm font-semibold text-ns-tertiary">{event.venueName}</p>
      )}
      {event.address && <p className="mt-1 text-sm text-ns-secondary">{event.address}</p>}
      {event.mapsUrl && (
        <p className="mt-1 text-sm">
          <a
            href={event.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-ns-primary hover:underline"
          >
            {t("mapsLink")}
          </a>
        </p>
      )}
      {event.introText && (
        <p className="mt-4 text-sm leading-relaxed text-ns-secondary">{event.introText}</p>
      )}
      {typeof event.priceMxn === "number" && event.priceMxn > 0 ? (
        <PriceBlock priceMxn={event.priceMxn} locale={locale} />
      ) : null}
      {event.menuIncluded ? (
        <div className="mt-4">
          <h2 className={FORM_SECTION_TITLE}>{t("menuIncluded")}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ns-secondary">
            {event.menuIncluded}
          </p>
        </div>
      ) : null}

      {success ? (
        <p className="mt-8 text-sm font-medium text-ns-primary">{t("rsvpSuccess")}</p>
      ) : (
        <form onSubmit={submitGuest} className="mt-8 space-y-4">
          <h2 className={FORM_SECTION_TITLE}>{t("rsvpTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>{t("fields.firstName")}</label>
              <input name="firstName" required className={INPUT_CLASS} disabled={submitting} />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("fields.lastName")}</label>
              <input name="lastName" required className={INPUT_CLASS} disabled={submitting} />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("fields.email")}</label>
              <input name="email" type="email" required className={INPUT_CLASS} disabled={submitting} />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("fields.whatsapp")}</label>
              <input name="whatsapp" required minLength={3} className={INPUT_CLASS} disabled={submitting} />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("fields.jobTitle")}</label>
              <input name="jobTitle" required className={INPUT_CLASS} disabled={submitting} />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("fields.company")}</label>
              <input name="companyName" required className={INPUT_CLASS} disabled={submitting} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS}>{t("fields.comments")}</label>
              <textarea name="comments" rows={2} className={INPUT_CLASS} disabled={submitting} />
            </div>
          </div>
          {error && <p className={ERROR_TEXT}>{error}</p>}
          <button type="submit" className={BTN_PRIMARY} disabled={submitting}>
            {t("submitRsvp")}
          </button>
        </form>
      )}
    </LaMesaShell>
  );
}
