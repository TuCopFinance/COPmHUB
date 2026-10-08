import type { ReactNode } from "react";
import type { State } from "@/components/offramp/types";

const STEPS = ["Correo", "Tus datos", "Identidad", "Llave Bre-B", "Listo"];

export function stepIndex(state: State): number {
  switch (state) {
    case "signed_out":
      return 0;
    case "new":
      return 1;
    case "kyc_pending":
    case "rejected":
    case "restricted":
      return 2;
    case "kyc_approved":
    case "destination_pending":
      return 3;
    case "destination_verified":
      return 4;
  }
}

export const inputClass =
  "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/20";
export const primaryClass =
  "inline-flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-50";
export const secondaryClass =
  "inline-flex items-center justify-center rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink transition-colors hover:border-brand/40 disabled:opacity-50";
export const headingClass =
  "text-xl font-extrabold tracking-tight text-ink outline-none";

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
      <path
        d="M2.5 6.5l2.2 2.2L9.5 3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Pasos">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={
              "flex items-center gap-2 text-xs font-bold " +
              (active ? "text-ink" : done ? "text-brand" : "text-muted/70")
            }
          >
            <span
              className={
                "flex h-6 w-6 items-center justify-center rounded-full text-[11px] " +
                (active
                  ? "bg-ink text-white"
                  : done
                    ? "bg-tint text-brand"
                    : "border border-line bg-white")
              }
            >
              {done ? <CheckIcon /> : index + 1}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export function StatusLine({
  label,
  done,
  reviewing = false,
}: {
  label: string;
  done: boolean;
  reviewing?: boolean;
}) {
  return (
    <span className="flex items-center gap-2 text-sm">
      <span
        className={"h-2 w-2 rounded-full " + (done ? "bg-[#137211]" : "bg-gold")}
        aria-hidden="true"
      />
      <span className="text-muted">
        {label}:{" "}
        <strong className="text-ink">
          {done ? "Listo" : reviewing ? "En revisión" : "Pendiente"}
        </strong>
      </span>
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-ink">
      {label}
      {children}
    </label>
  );
}
