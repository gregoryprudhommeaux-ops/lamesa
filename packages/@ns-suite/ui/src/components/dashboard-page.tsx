import {
  DASHBOARD_PAGE_DESC,
  DASHBOARD_PAGE_STACK,
  DASHBOARD_PAGE_WIDTH,
  META_LABEL,
  PAGE_TITLE,
} from "../tokens/nextstep";
import type { ReactNode } from "react";

export { DASHBOARD_PAGE_STACK };

export function DashboardPageShell({ children }: { children: ReactNode }) {
  return <div className={DASHBOARD_PAGE_STACK}>{children}</div>;
}

export type DashboardPageHeroProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  note?: ReactNode;
  titleExtra?: ReactNode;
  toolbar?: ReactNode;
  actions?: ReactNode;
  variant?: "gradient" | "card";
};

export function DashboardPageHero({
  eyebrow,
  title,
  subtitle,
  note,
  titleExtra,
  toolbar,
  actions,
  variant = "gradient",
}: DashboardPageHeroProps) {
  const shell =
    variant === "gradient"
      ? "relative overflow-hidden rounded-2xl border border-ns-primary/20 bg-gradient-to-br from-ns-brand-light via-white to-white p-6 shadow-sm md:p-8"
      : "rounded-2xl border border-gray-100 bg-ns-surface shadow-sm";

  const titleBlock = (
    <div className={DASHBOARD_PAGE_WIDTH}>
      {eyebrow ? <p className={META_LABEL}>{eyebrow}</p> : null}
      <div className={`flex flex-wrap items-center gap-2 ${eyebrow ? "mt-2" : ""}`}>
        <h1 className={PAGE_TITLE}>{title}</h1>
        {titleExtra}
      </div>
      {subtitle ? <p className={DASHBOARD_PAGE_DESC}>{subtitle}</p> : null}
      {note}
    </div>
  );

  if (variant === "card") {
    return (
      <section className={shell}>
        {toolbar ? (
          <div className="flex flex-col gap-4 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-end md:px-6">
            {toolbar}
          </div>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-5 md:px-6 md:py-6">
          {titleBlock}
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      </section>
    );
  }

  return (
    <section className={shell}>
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-ns-primary/15 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        {titleBlock}
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export type DashboardPageSectionProps = {
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted";
};

export function DashboardPageSection({
  children,
  className = "",
  tone = "default",
}: DashboardPageSectionProps) {
  const toneClass =
    tone === "muted"
      ? "border-ns-alternate/80 bg-ns-brand-light/30"
      : "border-gray-100 bg-ns-surface";

  return (
    <section
      className={`rounded-2xl border ${toneClass} p-4 shadow-sm md:p-6 ${className}`.trim()}
    >
      {children}
    </section>
  );
}

export function DashboardPageLoading({ children }: { children: ReactNode }) {
  return (
    <DashboardPageSection>
      <p className="text-center text-sm font-medium text-ns-secondary">{children}</p>
    </DashboardPageSection>
  );
}

export function DashboardPageError({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <DashboardPageSection className="border-rose-200 bg-rose-50/80">
      <p className="font-semibold text-rose-900">{message}</p>
      {onRetry && retryLabel ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-ns-hero px-4 py-2 text-sm font-semibold text-white hover:bg-ns-hero/90"
        >
          {retryLabel}
        </button>
      ) : null}
    </DashboardPageSection>
  );
}
