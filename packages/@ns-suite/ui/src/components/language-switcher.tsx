"use client";

import { useEffect, useId, useRef, useState } from "react";

export type NsLanguageSwitcherProps = {
  locales: readonly string[];
  activeLocale: string;
  /** Short labels per locale (e.g. FR, EN, ES). */
  localeLabels: Record<string, string>;
  onLocaleChange: (locale: string) => void;
  variant?: "light" | "dark";
  /** segmented = all locales visible; dropdown = active only until opened */
  mode?: "segmented" | "dropdown";
  className?: string;
};

export function NsLanguageSwitcher({
  locales,
  activeLocale,
  localeLabels,
  onLocaleChange,
  variant = "light",
  mode = "segmented",
  className = "",
}: NsLanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (mode === "dropdown") {
    const panelShell =
      variant === "dark"
        ? "border-white/20 bg-ns-hero text-white"
        : "border-ns-alternate bg-ns-surface text-ns-tertiary";
    const trigger =
      "border-ns-primary bg-ns-primary text-black hover:brightness-95";
    const idle =
      variant === "dark"
        ? "text-white/70 hover:bg-white/10 hover:text-ns-primary"
        : "text-ns-secondary hover:bg-ns-brand-light";

    const others = locales.filter((loc) => loc !== activeLocale);

    return (
      <div ref={rootRef} className={`relative ${className}`}>
        <button
          type="button"
          className={`inline-flex min-w-[2.75rem] items-center justify-center gap-1 rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-widest transition ${trigger}`}
          aria-label="Language"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
        >
          <span>{localeLabels[activeLocale] ?? activeLocale.toUpperCase()}</span>
          <span aria-hidden className="text-[8px] opacity-70">
            {open ? "▴" : "▾"}
          </span>
        </button>
        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Language"
            className={`absolute right-0 top-full z-30 mt-1 min-w-full overflow-hidden rounded-sm border py-0.5 shadow-lg ${panelShell}`}
          >
            {others.map((loc) => (
              <li key={loc} role="option" aria-selected={false}>
                <button
                  type="button"
                  className={`block w-full px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-widest transition ${idle}`}
                  onClick={() => {
                    onLocaleChange(loc);
                    setOpen(false);
                  }}
                >
                  {localeLabels[loc] ?? loc.toUpperCase()}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

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
