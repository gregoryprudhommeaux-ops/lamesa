/**
 * NS Calque — Swiss-Tech design tokens (Tailwind class strings).
 * Ratio: ~80% light surfaces, ~15% slate/charcoal structure, ~5% acid lime accent.
 */

export const NS = {
  primary: "#9DC41A",
  secondary: "#6B8FA8",
  tertiary: "#3D5166",
  hero: "#1A1A1A",
  brandLight: "#F8F9FA",
  alternate: "#D9D9D9",
  background: "#FFFFFF",
} as const;

/** Page shell */
export const PAGE_BG = "min-h-screen bg-ns-background";

/** Full width inside dashboard `<main>` (shell caps at max-w-5xl). */
export const DASHBOARD_PAGE_WIDTH = "w-full";
export const DASHBOARD_FORM = `${DASHBOARD_PAGE_WIDTH} space-y-6`;
export const DASHBOARD_FORM_COMPACT = `${DASHBOARD_PAGE_WIDTH} space-y-4`;

/** Subtitle under dashboard page heroes. */
export const DASHBOARD_PAGE_DESC =
  "mt-3 max-w-2xl text-sm font-medium leading-relaxed text-ns-secondary md:text-base";

/** Typography */
export const PAGE_TITLE =
  "text-2xl font-black uppercase tracking-tighter text-ns-tertiary md:text-3xl";
export const PAGE_DESC = "mt-2 max-w-xl text-sm font-medium leading-relaxed text-ns-secondary";
export const SECTION_TITLE =
  "text-base font-black uppercase tracking-tight text-ns-tertiary";
export const META_LABEL =
  "text-[10px] font-black uppercase tracking-widest text-ns-secondary";
export const BODY_TEXT = "text-sm font-medium leading-relaxed text-ns-secondary";
export const BODY_TEXT_DARK = "text-sm font-medium leading-relaxed text-ns-tertiary";

/** Cards */
export const CARD =
  "rounded-2xl border border-gray-100 bg-ns-surface p-5 shadow-sm transition-all";
export const CARD_SOFT = "rounded-2xl border border-gray-100 bg-ns-brand-light p-5";
export const CARD_INTERACTIVE =
  "group rounded-2xl border border-gray-100 bg-ns-surface p-6 transition-all hover:border-ns-primary hover:shadow-xl hover:-translate-y-0.5";

/** Forms */
export const LABEL_CLASS = "mb-1 block text-sm font-bold text-ns-tertiary";
export const INPUT_CLASS =
  "w-full rounded-lg border border-ns-alternate bg-ns-surface px-3 py-2.5 text-sm font-medium text-ns-tertiary placeholder:text-ns-secondary/60 outline-none transition-colors focus:border-ns-primary focus:ring-1 focus:ring-ns-primary/30";

/** Buttons — shared focus ring (WCAG 2.2) */
const BTN_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-primary/80 focus-visible:ring-offset-2";

export const BTN_PRIMARY = [
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ns-primary px-6 py-2.5",
  "text-sm font-semibold leading-snug text-black shadow-sm transition-all",
  "hover:bg-ns-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
  BTN_FOCUS,
].join(" ");

export const BTN_PRIMARY_SM = [
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-ns-primary px-4 py-2",
  "text-xs font-semibold leading-snug text-black shadow-sm transition-all",
  "hover:bg-ns-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
  BTN_FOCUS,
].join(" ");

export const BTN_PRIMARY_LG = [
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-ns-primary px-8 py-3",
  "text-base font-semibold leading-snug text-black shadow-md transition-all",
  "hover:bg-ns-primary/90",
  BTN_FOCUS,
].join(" ");

export const BTN_SECONDARY = [
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ns-alternate bg-ns-surface px-6 py-2.5",
  "text-sm font-semibold leading-snug text-ns-tertiary transition-all",
  "hover:border-ns-primary hover:bg-ns-brand-light disabled:cursor-not-allowed disabled:opacity-50",
  BTN_FOCUS,
].join(" ");

export const BTN_SECONDARY_ON_DARK = [
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/25 bg-transparent px-6 py-2.5",
  "text-sm font-semibold leading-snug text-white transition-all",
  "hover:border-white/45 hover:bg-white/10",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ns-hero",
].join(" ");

export const BTN_GHOST =
  "text-sm font-semibold text-ns-secondary transition-colors hover:text-ns-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-primary/80 focus-visible:ring-offset-2";

export const CHIP =
  "rounded-sm border border-ns-alternate px-3 py-1.5 text-xs font-bold text-ns-tertiary transition-all hover:border-ns-primary hover:bg-ns-brand-light";
export const CHIP_ACTIVE =
  "rounded-sm bg-ns-hero px-3 py-1.5 text-xs font-black uppercase tracking-wide text-ns-primary";

export const ERROR_TEXT = "text-sm font-medium text-red-600";

export const SCOPE_CARD_GENERALIST =
  "border-l-[5px] border-l-ns-primary bg-ns-surface";
export const SCOPE_CARD_NICHE =
  "border-l-[5px] border-l-ns-secondary bg-ns-surface";

/** Vertical rhythm shared by dashboard pages. */
export const DASHBOARD_PAGE_STACK = "w-full space-y-8 pb-10";
