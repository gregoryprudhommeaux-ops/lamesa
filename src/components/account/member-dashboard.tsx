"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Link } from "@/i18n/navigation";
import type { MePayload } from "@/lib/types/member-me";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  ERROR_TEXT,
  FORM_SECTION_TITLE,
  INPUT_CLASS,
  LABEL_CLASS,
} from "@/lib/ui/nextstep";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

type MemberDashboardProps = {
  data: MePayload;
};

const STAT_KEYS = [
  "invitationsReceived",
  "pastParticipations",
  "upcomingInvitations",
  "friendsReferred",
] as const;

export function MemberDashboard({ data }: MemberDashboardProps) {
  const t = useTranslations("account");
  const locale = useLocale();
  const authFetch = useAuthFetch();

  const { stats, referral, upcomingInvitations } = data;

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureInvite() {
    setLoadingInvite(true);
    setError(null);
    try {
      const res = await authFetch("/api/me/referral", {
        method: "POST",
        body: JSON.stringify({ action: "ensure", locale }),
      });
      const json = (await res.json()) as { ok?: boolean; inviteUrl?: string; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "referral_failed");
        return;
      }
      setInviteUrl(json.inviteUrl ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingInvite(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function sendInviteEmail(e: FormEvent) {
    e.preventDefault();
    setSendingEmail(true);
    setEmailSent(false);
    setError(null);
    try {
      const res = await authFetch("/api/me/referral", {
        method: "POST",
        body: JSON.stringify({ action: "invite_email", email, locale }),
      });
      const json = (await res.json()) as { ok?: boolean; inviteUrl?: string; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "invite_email_failed");
        return;
      }
      if (json.inviteUrl) setInviteUrl(json.inviteUrl);
      setEmailSent(true);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSendingEmail(false);
    }
  }

  const previewInvitations = (upcomingInvitations ?? []).slice(0, 3);

  return (
    <div className="space-y-8">
      <section>
        <h3 className={FORM_SECTION_TITLE}>{t("dashboard.statsTitle")}</h3>
        <div className="mt-3 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {STAT_KEYS.map((key) => (
            <div key={key}>
              <p className="text-3xl font-bold text-ns-hero">{stats[key]}</p>
              <p className="mt-1 text-xs text-ns-secondary">{t(`dashboard.stats.${key}`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 border-t border-gray-100 pt-6">
        <h3 className={FORM_SECTION_TITLE}>{t("dashboard.inviteTitle")}</h3>
        {error && <p className={ERROR_TEXT}>{error}</p>}

        {!referral.canBeSponsor ? (
          <p className="text-sm text-ns-secondary">{t("dashboard.adminCannotSponsor")}</p>
        ) : (
          <div className="space-y-4">
            {!inviteUrl && (
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={() => void ensureInvite()}
                disabled={loadingInvite}
              >
                {loadingInvite ? t("dashboard.generating") : t("dashboard.inviteCta")}
              </button>
            )}

            {inviteUrl && (
              <div className="space-y-4">
                <div>
                  <label className={LABEL_CLASS}>{t("dashboard.inviteUrlLabel")}</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className={`${INPUT_CLASS} flex-1`}
                      value={inviteUrl}
                      readOnly
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button type="button" className={BTN_SECONDARY} onClick={() => void copyInvite()}>
                      {copied ? t("dashboard.copied") : t("dashboard.copy")}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={LABEL_CLASS}>{t("dashboard.whatsappLabel")}</label>
                  <a
                    className={`${BTN_SECONDARY} inline-flex`}
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `${t("dashboard.whatsappMessage")} ${inviteUrl}`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("dashboard.whatsappCta")}
                  </a>
                </div>

                <form onSubmit={(e) => void sendInviteEmail(e)} className="space-y-2">
                  <label className={LABEL_CLASS}>{t("dashboard.emailLabel")}</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="email"
                      className={`${INPUT_CLASS} flex-1`}
                      placeholder={t("dashboard.emailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <button type="submit" className={BTN_SECONDARY} disabled={sendingEmail}>
                      {sendingEmail ? t("dashboard.sending") : t("dashboard.sendEmail")}
                    </button>
                  </div>
                  {emailSent && (
                    <p className="text-sm font-medium text-ns-primary">
                      {t("dashboard.emailSentConfirmation")}
                    </p>
                  )}
                </form>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3 border-t border-gray-100 pt-6">
        <h3 className={FORM_SECTION_TITLE}>{t("upcomingTitle")}</h3>
        {previewInvitations.length === 0 ? (
          <p className="text-sm text-ns-secondary">{t("upcomingEmpty")}</p>
        ) : (
          <ul className="space-y-3">
            {previewInvitations.map((inv) => (
              <li
                key={inv.participationId}
                className="rounded-xl border border-gray-100 bg-ns-brand-light/50 p-4 text-sm"
              >
                <p className="font-bold text-ns-tertiary">{inv.event.title}</p>
                <p className="mt-1 text-ns-secondary">
                  {new Date(inv.event.startsAt).toLocaleString(locale)}
                  {inv.event.venueName ? ` · ${inv.event.venueName}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/compte?tab=calendrier"
          className="inline-block text-xs font-semibold text-ns-primary hover:underline"
        >
          {t("dashboard.viewCalendar")}
        </Link>
      </section>
    </div>
  );
}
