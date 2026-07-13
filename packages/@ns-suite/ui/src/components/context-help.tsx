"use client";

import type { ReactNode } from "react";

export type ContextHelpProps = {
  /** Accessible name for the help trigger. */
  label: string;
  children: ReactNode;
  className?: string;
};

/** Compact contextual help — native details, no JS tooltip library. */
export function ContextHelp({ label, children, className = "" }: ContextHelpProps) {
  return (
    <details className={`group relative inline-block text-left ${className}`}>
      <summary
        className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border border-ns-alternate bg-white text-xs font-bold text-ns-secondary transition hover:border-ns-primary hover:text-ns-primary marker:content-none [&::-webkit-details-marker]:hidden"
        aria-label={label}
      >
        ?
      </summary>
      <div className="absolute left-0 top-full z-20 mt-2 w-[min(100vw-2rem,22rem)] rounded-lg border border-gray-200 bg-white p-3 text-sm font-normal leading-relaxed text-ns-secondary shadow-lg">
        {children}
      </div>
    </details>
  );
}
