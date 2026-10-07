"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { OFFRAMP_COPY } from "@/lib/offramp/copy";
import { ArrowIcon } from "@/components/offramp/ArrowIcon";
import {
  markOfframpPopupSeen,
  offrampPopupSeen,
} from "@/components/offramp/popupStorage";

/** Shown once per browser. Dismissing it, or following it, ends it for good. */
export function OfframpPopup() {
  const [open, setOpen] = useState(false);
  const cta = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (offrampPopupSeen()) return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      track("offramp_popup_view", { section: "popup" });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  const close = useCallback(() => {
    markOfframpPopupSeen();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    cta.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="offramp-popup-title"
        className="reveal relative w-full max-w-md rounded-[20px] border border-line bg-white p-6 shadow-xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-ink"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
            <path
              d="M2 2l8 8M10 2l-8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <span className="rounded-full bg-celo-yellow px-2 py-0.5 text-[10px] font-bold tracking-wide text-ink">
          NUEVO: YA DISPONIBLE
        </span>
        <h2
          id="offramp-popup-title"
          className="mt-4 text-2xl font-extrabold tracking-tight text-ink"
        >
          {OFFRAMP_COPY.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {OFFRAMP_COPY.body}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <a
            ref={cta}
            href={OFFRAMP_COPY.href}
            onClick={markOfframpPopupSeen}
            data-track="landing_cta_click"
            data-label={OFFRAMP_COPY.cta}
            data-section="popup"
            data-product="offramp"
            className="inline-flex items-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white"
          >
            {OFFRAMP_COPY.cta}
            <ArrowIcon />
          </a>
          <button
            type="button"
            onClick={close}
            className="text-sm font-semibold text-muted hover:text-ink"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
