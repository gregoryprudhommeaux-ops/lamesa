"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { LaMesaShell } from "@/components/la-mesa-shell";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { INTEREST_DECLINE_REASONS, isInterestDeadlinePassed } from "@/lib/events/event-interest";
import {
  formatAccessIncludes,
  formatMenuPriceEstimate,
  hasNegotiatedMenuInfo,
} from "@/lib/events/event-pricing-copy";
import { computeEventIva, formatMxn } from "@/lib/events/pricing";
import { resolveEventPricingMode } from "@/lib/events/pricing-mode";
import { fmtDateTime } from "@/lib/events/utils";
import { getClientFirestore, isFirebaseClientConfigured } from "@/lib/firebase/client";
import type {
  AdminEvent,
  EventInterestDeclineReason,
  EventInterestResponse,
} from "@/lib/types/events";
import {
  BTN_PRIMARY,
  ERROR_TEXT,
  FORM_SECTION_TITLE,
  INPUT_CLASS,
  LABEL_CLASS,
  PAGE_TITLE,
} from "@/lib/ui/nextstep";
import { addDoc, collection, getDocs, limit, query, where } from "firebase/firestore";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** Lightweight bold markers in admin-authored intro copy: <bold>…</bold> or **…**. */
function renderIntroRichText(text: string): ReactNode {
  const parts = text.split(/(<bold>[\s\S]*?<\/bold>|\*\*[^*]+\*\*)/gi);
  return parts.map((part, index) => {
    const boldTag = part.match(/^<bold>([\s\S]*?)<\/bold>$/i);
    if (boldTag) {
      return (
        <strong key={index} className="font-semibold text-ns-tertiary">
          {boldTag[1].trim()}
        </strong>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-ns-tertiary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

type PublicEventPageProps = {
  slug: string;
  locale: "fr" | "en" | "es";
};

function mapEventDoc(id: string, slug: string, data: Record<string, unknown>): AdminEvent {
  return {
    id,
    slug: String(data.slug ?? slug),
    title: String(data.title ?? ""),
    subtitle: data.subtitle ? String(data.subtitle) : undefined,
    organizerName: data.organizerName ? String(data.organizerName) : undefined,
    introText: data.introText ? String(data.introText) : undefined,
    venueName: data.venueName ? String(data.venueName) : undefined,
    address: data.address ? String(data.address) : undefined,
    mapsUrl: data.mapsUrl ? String(data.mapsUrl) : undefined,
    startsAt: String(data.startsAt ?? ""),
    endsAt: data.endsAt ? String(data.endsAt) : undefined,
    capacity: typeof data.capacity === "number" ? data.capacity : undefined,
    priceMxn: typeof data.priceMxn === "number" ? data.priceMxn : undefined,
    accessIncludesWelcomeDrink: Boolean(data.accessIncludesWelcomeDrink),
    accessIncludesAmuseBouche: Boolean(data.accessIncludesAmuseBouche),
    menuIncluded: data.menuIncluded ? String(data.menuIncluded) : undefined,
    menuPriceMinMxn:
      typeof data.menuPriceMinMxn === "number" ? data.menuPriceMinMxn : undefined,
    menuPriceMaxMxn:
      typeof data.menuPriceMaxMxn === "number" ? data.menuPriceMaxMxn : undefined,
    menuIncludesDrinks:
      data.menuIncludesDrinks === true
        ? true
        : data.menuIncludesDrinks === false
          ? false
          : null,
    pricingMode:
      data.pricingMode === "all_inclusive" || data.pricingMode === "ticket_onsite"
        ? data.pricingMode
        : undefined,
    parking:
      data.parking === "secure_nearby" ||
      data.parking === "valet" ||
      data.parking === "on_site" ||
      data.parking === "unknown"
        ? data.parking
        : undefined,
    responseMode: data.responseMode === "interest" ? "interest" : "rsvp",
    interestDeadlineAt: data.interestDeadlineAt ? String(data.interestDeadlineAt) : null,
    allInPriceMinMxn:
      typeof data.allInPriceMinMxn === "number" ? data.allInPriceMinMxn : null,
    allInPriceMaxMxn:
      typeof data.allInPriceMaxMxn === "number" ? data.allInPriceMaxMxn : null,
    status: "published",
  };
}

function PriceBlock({
  event,
  locale,
}: {
  event: AdminEvent;
  locale: "fr" | "en" | "es";
}) {
  const t = useTranslations("publicEvent");
  const mode = resolveEventPricingMode(event);
  const priceMxn = event.priceMxn;
  const hasAccess = typeof priceMxn === "number" && priceMxn > 0;
  const hasMenu = hasNegotiatedMenuInfo(event);
  if (!hasAccess && !hasMenu) return null;

  const pricing =
    hasAccess && typeof priceMxn === "number" ? computeEventIva(priceMxn) : null;
  const estimate = formatMenuPriceEstimate(event, locale);
  const accessLine = formatAccessIncludes(event, locale);
  const showAccessIncludes =
    mode === "ticket_onsite" &&
    (event.accessIncludesWelcomeDrink || event.accessIncludesAmuseBouche);
  const parkingAvailable = event.parking && event.parking !== "unknown";

  if (mode === "all_inclusive") {
    return (
      <div className="mt-4 space-y-3">
        {pricing ? (
          <div className="rounded-xl border border-ns-alternate bg-ns-brand-light/30 px-4 py-3 text-sm">
            <p className="font-semibold text-ns-tertiary">
              {t("priceAllIn")} · {formatMxn(pricing.priceBeforeTax, locale)}
            </p>
            <p className="mt-1 text-xs text-ns-secondary">
              {t("iva")}: {formatMxn(pricing.iva, locale)} · {t("totalWithIva")}:{" "}
              <strong>{formatMxn(pricing.totalWithIva, locale)}</strong>
            </p>
            <p className="mt-2 text-xs text-ns-secondary">{t("priceAllInHint")}</p>
            {event.menuIncludesDrinks === true ? (
              <p className="mt-1 text-xs text-ns-secondary">{t("menuDrinksIncluded")}</p>
            ) : null}
            {event.menuIncludesDrinks === false ? (
              <p className="mt-1 text-xs text-ns-secondary">{t("menuDrinksNotIncluded")}</p>
            ) : null}
          </div>
        ) : null}
        {event.menuIncluded?.trim() ? (
          <div className="rounded-xl border border-ns-alternate px-4 py-3 text-sm">
            <h2 className={FORM_SECTION_TITLE}>{t("menuIncluded")}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ns-secondary">
              {event.menuIncluded}
            </p>
          </div>
        ) : null}
        {parkingAvailable ? (
          <p className="text-xs text-ns-secondary">{t("parkingOnSiteHint")}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {pricing ? (
        <div className="rounded-xl border border-ns-alternate bg-ns-brand-light/30 px-4 py-3 text-sm">
          <p className="font-semibold text-ns-tertiary">
            {t("price")} · {formatMxn(pricing.priceBeforeTax, locale)}
          </p>
          <p className="mt-1 text-xs text-ns-secondary">
            {t("iva")}: {formatMxn(pricing.iva, locale)} · {t("totalWithIva")}:{" "}
            <strong>{formatMxn(pricing.totalWithIva, locale)}</strong>
          </p>
          {showAccessIncludes ? (
            <p className="mt-2 text-xs text-ns-secondary">
              {t("accessIncludes")}: {accessLine}
            </p>
          ) : null}
        </div>
      ) : null}
      {hasMenu ? (
        <div className="rounded-xl border border-ns-alternate px-4 py-3 text-sm">
          <h2 className={FORM_SECTION_TITLE}>{t("menuIncluded")}</h2>
          {event.menuIncluded?.trim() ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ns-secondary">
              {event.menuIncluded}
            </p>
          ) : null}
          {estimate ? (
            <p className="mt-2 text-xs text-ns-secondary">
              {t("menuEstimate")}: <strong>{estimate}</strong>
            </p>
          ) : null}
          {event.menuIncludesDrinks === true ? (
            <p className="mt-1 text-xs text-ns-secondary">{t("menuDrinksIncluded")}</p>
          ) : null}
          {event.menuIncludesDrinks === false ? (
            <p className="mt-1 text-xs text-ns-secondary">{t("menuDrinksNotIncluded")}</p>
          ) : null}
        </div>
      ) : null}
      {parkingAvailable ? (
        <p className="text-xs text-ns-secondary">{t("parkingOnSiteHint")}</p>
      ) : null}
    </div>
  );
}

function interestDraftKey(slug: string): string {
  return `la-mesa:interest-draft:${slug}`;
}

type InterestDraft = {
  interestResponse: EventInterestResponse;
  declineReason: EventInterestDeclineReason | "";
  declineReasonOther: string;
  expectations: string;
  ideasComment: string;
};

function readInterestDraft(slug: string): InterestDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(interestDraftKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InterestDraft;
    if (!parsed?.interestResponse) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeInterestDraft(slug: string, draft: InterestDraft): void {
  try {
    sessionStorage.setItem(interestDraftKey(slug), JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

function clearInterestDraft(slug: string): void {
  try {
    sessionStorage.removeItem(interestDraftKey(slug));
  } catch {
    /* ignore */
  }
}

function InterestForm({
  event,
}: {
  event: AdminEvent;
}) {
  const t = useTranslations("publicEvent");
  const { user, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const pathname = usePathname();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    interestResponse: EventInterestResponse;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [memberProfile, setMemberProfile] = useState<{
    fullName: string;
    email: string;
    company: string;
  } | null>(null);
  const [notOnWaitlist, setNotOnWaitlist] = useState(false);
  const autoSubmitAttempted = useRef(false);

  const [interestResponse, setInterestResponse] = useState<EventInterestResponse | "">("");
  const [declineReason, setDeclineReason] = useState<EventInterestDeclineReason | "">("");
  const [declineReasonOther, setDeclineReasonOther] = useState("");
  const [expectations, setExpectations] = useState("");
  const [ideasComment, setIdeasComment] = useState("");

  const deadlinePassed = useMemo(
    () => isInterestDeadlinePassed(event.interestDeadlineAt),
    [event.interestDeadlineAt],
  );

  const loginHref = `/connexion?next=${encodeURIComponent(pathname)}`;
  const signupHref = `/connexion?next=${encodeURIComponent(pathname)}&mode=signup`;

  useEffect(() => {
    const draft = readInterestDraft(event.slug);
    if (!draft) return;
    setInterestResponse(draft.interestResponse);
    setDeclineReason(draft.declineReason);
    setDeclineReasonOther(draft.declineReasonOther);
    setExpectations(draft.expectations);
    setIdeasComment(draft.ideasComment);
  }, [event.slug]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setMemberProfile(null);
      setNotOnWaitlist(false);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);
    void (async () => {
      try {
        const res = await authFetch("/api/me");
        const json = (await res.json()) as {
          ok?: boolean;
          notOnWaitlist?: boolean;
          profile?: {
            fullName?: string;
            email?: string;
            company?: string;
          } | null;
        };
        if (cancelled) return;
        if (!res.ok || !json.ok || json.notOnWaitlist || !json.profile) {
          setMemberProfile(null);
          setNotOnWaitlist(true);
          return;
        }
        setNotOnWaitlist(false);
        setMemberProfile({
          fullName: String(json.profile.fullName ?? ""),
          email: String(json.profile.email ?? user.email ?? ""),
          company: String(json.profile.company ?? ""),
        });
      } catch {
        if (!cancelled) {
          setMemberProfile(null);
          setNotOnWaitlist(true);
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, authFetch]);

  function mapError(code: string | undefined): string {
    if (!code) return t("errors.generic");
    const known = [
      "deadline_passed",
      "decline_reason_required",
      "decline_reason_other_required",
      "other_text_required",
      "expectations_required",
      "unauthorized",
      "not_on_waitlist",
      "validation",
    ] as const;
    if ((known as readonly string[]).includes(code)) {
      return t(`errors.${code}` as "errors.generic");
    }
    return t("errors.generic");
  }

  function currentDraft(): InterestDraft | null {
    if (!interestResponse) return null;
    return {
      interestResponse,
      declineReason,
      declineReasonOther,
      expectations,
      ideasComment,
    };
  }

  function validateClient(): string | null {
    if (!interestResponse) return t("errors.validation");
    if (interestResponse === "no" && !declineReason) return t("errors.decline_reason_required");
    if (
      (interestResponse === "other" || declineReason === "other") &&
      !declineReasonOther.trim()
    ) {
      return t("errors.other_text_required");
    }
    if (interestResponse === "yes" && !expectations.trim()) {
      return t("errors.expectations_required");
    }
    return null;
  }

  async function submitInterest(draft: InterestDraft) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(`/api/events/${encodeURIComponent(event.slug)}/interest`, {
        method: "POST",
        body: JSON.stringify({
          interestResponse: draft.interestResponse,
          declineReason: draft.declineReason || null,
          declineReasonOther: draft.declineReasonOther || null,
          expectations: draft.expectations || null,
          ideasComment: draft.ideasComment || null,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        interestResponse?: EventInterestResponse;
      };
      if (!res.ok || !json.ok) {
        setError(mapError(json.error));
        return;
      }
      clearInterestDraft(event.slug);
      setDone({
        interestResponse: json.interestResponse ?? draft.interestResponse,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (authLoading || profileLoading || !user || !memberProfile || deadlinePassed) return;
    if (autoSubmitAttempted.current) return;
    const draft = readInterestDraft(event.slug);
    if (!draft) return;
    autoSubmitAttempted.current = true;
    void submitInterest(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot after login return
  }, [authLoading, profileLoading, user, memberProfile, deadlinePassed, event.slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || deadlinePassed) return;
    setError(null);

    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    const draft = currentDraft();
    if (!draft) return;

    if (!user) {
      writeInterestDraft(event.slug, draft);
      router.push(loginHref);
      return;
    }

    if (profileLoading) return;

    if (notOnWaitlist || !memberProfile) {
      writeInterestDraft(event.slug, draft);
      setError(t("errors.not_on_waitlist"));
      return;
    }

    await submitInterest(draft);
  }

  if (done) {
    const successKey =
      done.interestResponse === "yes"
        ? "interestSuccessYes"
        : done.interestResponse === "no"
          ? "interestSuccessNo"
          : "interestSuccessOther";
    return (
      <div className="mt-8 space-y-6">
        <p className="text-sm font-medium text-ns-primary">{t(successKey)}</p>
        <p className="border-t border-gray-100 pt-4 text-center text-xs text-ns-secondary">
          {t("profileSuggestionPrefix")}{" "}
          <Link
            href="/compte?tab=profil"
            className="font-semibold text-ns-primary underline-offset-2 hover:underline"
          >
            {t("profileSuggestionLink")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4" noValidate>
      <h2 className={FORM_SECTION_TITLE}>{t("interestTitle")}</h2>
      {deadlinePassed ? (
        <p className={ERROR_TEXT}>{t("interestDeadlinePassed")}</p>
      ) : null}

      {memberProfile ? (
        <p className="text-sm text-ns-secondary">
          {t("interestSignedInAs", {
            name: memberProfile.fullName || memberProfile.email,
            email: memberProfile.email,
          })}
        </p>
      ) : null}

      <fieldset className="space-y-2">
        <legend className={LABEL_CLASS}>{t("interestChoiceLabel")}</legend>
        {(
          [
            ["yes", "interestYes"],
            ["no", "interestNo"],
            ["other", "interestOther"],
          ] as const
        ).map(([value, labelKey]) => (
          <label key={value} className="flex items-center gap-2 text-sm text-ns-tertiary">
            <input
              type="radio"
              name="interestResponse"
              value={value}
              checked={interestResponse === value}
              onChange={() => {
                setInterestResponse(value);
                if (value !== "no") setDeclineReason("");
              }}
              disabled={submitting || deadlinePassed}
            />
            {t(labelKey)}
          </label>
        ))}
      </fieldset>

      {interestResponse === "no" ? (
        <div>
          <label className={LABEL_CLASS} htmlFor="decline-reason">
            {t("declineReasonLabel")}
          </label>
          <select
            id="decline-reason"
            className={INPUT_CLASS}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value as EventInterestDeclineReason)}
            required
            disabled={submitting || deadlinePassed}
          >
            <option value="">—</option>
            {INTEREST_DECLINE_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {t(`declineReasons.${reason}`)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {interestResponse === "other" || declineReason === "other" ? (
        <div>
          <label className={LABEL_CLASS}>{t("otherTextLabel")}</label>
          <textarea
            className={`${INPUT_CLASS} resize-y`}
            rows={3}
            value={declineReasonOther}
            onChange={(e) => setDeclineReasonOther(e.target.value)}
            required
            disabled={submitting || deadlinePassed}
          />
        </div>
      ) : null}

      {interestResponse === "yes" ? (
        <div>
          <label className={LABEL_CLASS}>{t("expectationsLabel")}</label>
          <textarea
            className={`${INPUT_CLASS} resize-y`}
            rows={3}
            value={expectations}
            onChange={(e) => setExpectations(e.target.value)}
            placeholder={t("expectationsPlaceholder")}
            required
            disabled={submitting || deadlinePassed}
          />
        </div>
      ) : null}

      <div>
        <label className={LABEL_CLASS}>{t("ideasLabel")}</label>
        <textarea
          className={`${INPUT_CLASS} resize-y`}
          rows={2}
          value={ideasComment}
          onChange={(e) => setIdeasComment(e.target.value)}
          disabled={submitting || deadlinePassed}
        />
      </div>

      {error && !(user && notOnWaitlist) ? <p className={ERROR_TEXT}>{error}</p> : null}

      {!user && !deadlinePassed ? (
        <>
          <button
            type="submit"
            className={BTN_PRIMARY}
            disabled={submitting || deadlinePassed || authLoading}
          >
            {submitting ? t("loading") : t("submitInterestAuthCta")}
          </button>
          <p className="text-xs text-ns-secondary">
            <Link href={signupHref} className="font-semibold text-ns-primary underline-offset-2 hover:underline">
              {t("interestSignupCta")}
            </Link>
          </p>
        </>
        ) : user && notOnWaitlist && !deadlinePassed ? (
        <Link href={loginHref} className={BTN_PRIMARY}>
          {t("submitInterestAuthCta")}
        </Link>
      ) : (
        <button
          type="submit"
          className={BTN_PRIMARY}
          disabled={submitting || deadlinePassed || authLoading || profileLoading}
        >
          {submitting || profileLoading ? t("loading") : t("submitInterest")}
        </button>
      )}

      <p className="pt-2 text-center text-xs text-ns-secondary">
        {t("interestContactPrefix")}{" "}
        <a
          href="mailto:greg@nextstep-services.com"
          className="font-semibold text-ns-primary underline-offset-2 hover:underline"
        >
          greg@nextstep-services.com
        </a>
      </p>
    </form>
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
        setEvent(mapEventDoc(docSnap.id, slug, docSnap.data() as Record<string, unknown>));
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

  const interestMode = event.responseMode === "interest";

  return (
    <LaMesaShell card cardClassName="max-w-xl">
      {interestMode ? (
        <p className="text-center text-sm font-bold uppercase tracking-[0.16em] text-ns-primary">
          {t("interestBadge")}
        </p>
      ) : null}
      <h1
        className={`${PAGE_TITLE} text-ns-hero ${interestMode ? "mt-3" : "mt-0"} text-balance text-center`}
      >
        {event.title}
      </h1>
      {event.subtitle?.trim() ? (
        <p className="mt-2 text-center text-sm font-semibold text-ns-tertiary">{event.subtitle}</p>
      ) : null}

      <div className="mt-5 space-y-1.5 text-center">
        <p className="text-base font-bold text-ns-hero">
          {fmtDateTime(event.startsAt, locale)}
        </p>
        {interestMode && event.interestDeadlineAt ? (
          <p className="text-sm font-semibold text-ns-tertiary">
            {t.rich("interestDeadline", {
              date: fmtDateTime(event.interestDeadlineAt, locale),
              bold: (chunks) => (
                <strong className="font-bold text-ns-hero">{chunks}</strong>
              ),
            })}
          </p>
        ) : null}
        {interestMode ? (
          <p className="text-sm font-semibold text-ns-tertiary">
            {event.venueName?.trim() || event.address?.trim()
              ? [event.venueName, event.address].filter(Boolean).join(" — ")
              : t("venueTbd")}
          </p>
        ) : (
          <>
            {event.venueName ? (
              <p className="text-sm font-bold text-ns-tertiary">{event.venueName}</p>
            ) : null}
            {event.address ? (
              <p className="text-sm font-medium text-ns-secondary">{event.address}</p>
            ) : null}
          </>
        )}
        {event.mapsUrl ? (
          <p className="text-sm">
            <a
              href={event.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-ns-primary hover:underline"
            >
              {t("mapsLink")}
            </a>
          </p>
        ) : null}
      </div>

      {event.introText ? (
        <div className="mt-6 space-y-3 text-sm leading-relaxed text-ns-secondary">
          {event.introText
            .split(/\n\s*\n/)
            .map((para) => para.trim())
            .filter(Boolean)
            .map((para) => (
              <p key={para.slice(0, 48)}>{renderIntroRichText(para)}</p>
            ))}
        </div>
      ) : null}

      {interestMode ? null : (typeof event.priceMxn === "number" && event.priceMxn > 0) ||
        hasNegotiatedMenuInfo(event) ? (
        <PriceBlock event={event} locale={locale} />
      ) : null}

      {interestMode ? (
        <InterestForm event={event} />
      ) : success ? (
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
