"use client";

import { normalizeBreBKey } from "@/lib/offramp/breb";
import { primaryClass } from "@/components/offramp/ui";

/**
 * One of Bridge's pages inside the form. When the link is not one this site
 * can frame, or the frame does not load for the person, the same page opens
 * in a new tab as it always did.
 */
export function BridgeStep({
  title,
  body,
  frameTitle,
  src,
  link,
  linkLabel,
  help,
  height,
  sandbox,
  allow,
  onOpenTab,
}: {
  title: string;
  body: string;
  frameTitle: string;
  src: string | null;
  link: string;
  linkLabel: string;
  help: string;
  height: number;
  sandbox: string;
  allow?: string;
  onOpenTab: () => void;
}) {
  return (
    <section className="mt-6">
      <h3 className="text-base font-extrabold tracking-tight text-ink">{title}</h3>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">{body}</p>
      {src ? (
        <>
          <iframe
            src={src}
            title={frameTitle}
            allow={allow}
            sandbox={sandbox}
            style={{ height }}
            className="mt-4 w-full rounded-2xl border border-line bg-white"
          />
          <p className="mt-3 text-sm text-muted">
            {help}{" "}
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand underline"
              onClick={onOpenTab}
            >
              Ábrelo en una pestaña nueva
            </a>
            .
          </p>
        </>
      ) : (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className={primaryClass + " mt-4"}
          onClick={onOpenTab}
        >
          {linkLabel}
        </a>
      )}
    </section>
  );
}

export function WaitPanel({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="mt-5 flex max-w-prose gap-3 rounded-2xl border border-brand/25 bg-tint p-4"
      role="status"
      aria-live="polite"
    >
      <span
        className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand/25 border-t-brand"
        aria-hidden="true"
      />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 text-muted">{body}</p>
      </div>
    </div>
  );
}

export function KeyHint({ value }: { value: string }) {
  const trimmed = value.replace(/\s+/g, "");
  const normalized = normalizeBreBKey(value);
  return (
    <div className="mt-2 text-xs leading-relaxed text-muted">
      {trimmed && normalized !== trimmed ? (
        <p className="font-semibold text-ink" aria-live="polite">
          Se usará como {normalized}
        </p>
      ) : null}
      <p>
        Escríbela tal como aparece en tu banco. Celular: 3001234567.
        Documento: solo números. Correo: tu@correo.com. Llave alfanumérica:
        empieza con @, por ejemplo @juanperez (si la escribes sin @, la
        agregamos).
      </p>
    </div>
  );
}
