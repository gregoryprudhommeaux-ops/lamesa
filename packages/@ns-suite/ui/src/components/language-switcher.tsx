"use client";

export type NsLanguageSwitcherProps = {
  locales: readonly string[];
  activeLocale: string;
  /** Short labels per locale (e.g. FR, EN, ES). */
  localeLabels: Record<string, string>;
  onLocaleChange: (locale: string) => void;
  variant?: "light" | "dark";
  className?: string;
};

export function NsLanguageSwitcher({
  locales,
  activeLocale,
  localeLabels,
  onLocaleChange,
  variant = "light",
  className = "",
}: NsLanguageSwitcherProps) {
  const shell =
    variant === "dark"
      ? "rounded-sm border border-white/20 bg-ns-hero p-0.5"
      : "rounded-sm border border-ns-alternate bg-ns-surface p-0.5";

  const active = "bg-ns-primary text-black";
  const idle =
    variant === "dark"
      ? "text-white/70 hover:text-ns-primary"
      : "text-ns-secondary hover:bg-ns-brand-light";

  return (
    <div
      className={`flex gap-0.5 text-[10px] font-black uppercase tracking-widest ${shell} ${className}`}
      role="group"
      aria-label="Language"
    >
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => onLocaleChange(loc)}
          className={`rounded-sm px-2 py-1 transition-colors ${
            activeLocale === loc ? active : idle
          }`}
          aria-pressed={activeLocale === loc}
        >
          {localeLabels[loc] ?? loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
