"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Liste (command center) vs calendrier mois — same Dîners destination.
 */
export function AdminDinersViewToggle() {
  const pathname = usePathname() ?? "/admin/evenements";
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const isCal = view === "calendrier";

  const listHref = (() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("view");
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  const calHref = (() => {
    const p = new URLSearchParams();
    p.set("view", "calendrier");
    return `${pathname}?${p.toString()}`;
  })();

  return (
    <nav aria-label="Vue Dîners" className="mb-4 flex flex-wrap gap-1.5">
      <Link
        href={listHref}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
          !isCal
            ? "bg-ns-primary text-ns-tertiary"
            : "border border-ns-alternate bg-white text-ns-secondary hover:border-ns-primary hover:text-ns-tertiary"
        }`}
        aria-current={!isCal ? "page" : undefined}
      >
        Pilotage
      </Link>
      <Link
        href={calHref}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
          isCal
            ? "bg-ns-primary text-ns-tertiary"
            : "border border-ns-alternate bg-white text-ns-secondary hover:border-ns-primary hover:text-ns-tertiary"
        }`}
        aria-current={isCal ? "page" : undefined}
      >
        Calendrier
      </Link>
    </nav>
  );
}
