"use client";

import { EventEmailTemplateEditor } from "@/components/admin/admin-event-email-template-editor";
import type { AdminEvent, EmailTemplateKey } from "@/lib/types/events";
import { BTN_SECONDARY } from "@/lib/ui/nextstep";
import { FilePenLine, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

type EventTemplateDrawerProps = {
  event: AdminEvent;
  templateKey: EmailTemplateKey;
  label: string;
  hint?: string;
  onEventUpdated?: () => void;
};

/**
 * Keeps the primary send CTA unblocked: template editing opens in a drawer.
 */
export function EventTemplateDrawer({
  event,
  templateKey,
  label,
  hint,
  onEventUpdated,
}: EventTemplateDrawerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${BTN_SECONDARY} inline-flex items-center gap-2 text-xs`}
          onClick={() => setOpen(true)}
        >
          <FilePenLine className="h-3.5 w-3.5" />
          {label}
        </button>
        {hint ? <p className="text-[11px] text-ns-secondary">{hint}</p> : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="presentation">
          <button
            type="button"
            className="h-full flex-1 cursor-default"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex h-full w-full max-w-lg flex-col border-l border-gray-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 id={titleId} className="text-sm font-bold text-ns-hero">
                {label}
              </h2>
              <button
                type="button"
                className="rounded p-1 text-ns-secondary hover:bg-ns-brand-light hover:text-ns-tertiary"
                onClick={() => setOpen(false)}
                aria-label="Fermer le tiroir"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <EventEmailTemplateEditor
                event={event}
                templateKey={templateKey}
                onEventUpdated={onEventUpdated}
                hint={hint}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
