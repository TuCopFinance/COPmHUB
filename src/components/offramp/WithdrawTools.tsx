"use client";

import { useEffect, useState } from "react";
import {
  formatCop,
  formatUsdc,
  payoutPhase,
  settlementWindow,
  type PayoutPhase,
} from "@/lib/offramp/flow";
import { GENERIC_ERROR, SESSION_CODES } from "@/lib/offramp/messages";
import { RampError, ramp } from "@/components/offramp/api";
import type { Payout, Quote, Withdrawal } from "@/components/offramp/types";
import { Field, inputClass, secondaryClass } from "@/components/offramp/ui";

// Bridge does not pay out below this (also in withdrawal.deposit).
const FLOOR_COP = 4000;

/** Payout statuses, in words. */
const PAYOUT_LABEL: Record<PayoutPhase, string> = {
  processing: "En proceso",
  paid: "Pagado",
  failed: "No se pudo pagar",
  returned: "Devuelto a tu billetera",
  canceled: "Cancelado",
};

const PAYOUT_TONE: Record<PayoutPhase, string> = {
  processing: "text-muted",
  paid: "font-semibold text-[#137211]",
  failed: "font-semibold text-co-red",
  returned: "text-ink",
  canceled: "text-muted",
};

function errorText(cause: unknown): string {
  return cause instanceof RampError ? cause.message : GENERIC_ERROR;
}

function isSessionError(cause: unknown): boolean {
  return cause instanceof RampError && Boolean(cause.code && SESSION_CODES.has(cause.code));
}

/** How much USDC to send so a given amount of pesos arrives. Only a price. */
export function QuoteCalculator({
  withdrawal,
  onSessionExpired,
}: {
  withdrawal: Withdrawal;
  onSessionExpired: () => void;
}) {
  const minimum = Number(withdrawal.deposit.minimum_destination_amount?.amount) || FLOOR_COP;
  const [pesos, setPesos] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    const value = Number(pesos.replace(/\D/g, ""));
    if (!Number.isInteger(value) || value < minimum) {
      setError(`El mínimo es ${formatCop(String(minimum))} COP.`);
      setQuote(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await ramp<Quote>("POST", "v1/quotes", {
        product: "withdraw",
        destination_id: withdrawal.destination_id,
        amount_cop: { amount: `${value}.00`, asset: "COP" },
      });
      setQuote(data);
    } catch (cause) {
      if (isSessionError(cause)) return onSessionExpired();
      setQuote(null);
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="mt-6 max-w-xl rounded-2xl border border-line bg-bg p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void ask();
      }}
    >
      <p className="text-sm font-semibold text-ink">¿Cuánto USDC envío?</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <Field label="Pesos que quieres recibir">
            <input
              className={inputClass}
              value={pesos}
              onChange={(event) => {
                setPesos(event.target.value.replace(/[^\d.]/g, ""));
                setQuote(null);
              }}
              inputMode="numeric"
              placeholder="100000"
              autoComplete="off"
            />
          </Field>
        </div>
        <button type="submit" disabled={busy || !pesos} className={secondaryClass}>
          {busy ? "Calculando..." : "Calcular"}
        </button>
      </div>
      {quote ? (
        <p className="mt-4 text-sm leading-relaxed text-ink" role="status">
          Envía al menos{" "}
          <strong>
            {formatUsdc(quote.source_amount.amount) ?? quote.source_amount.amount} USDC
          </strong>{" "}
          para recibir <strong>{formatCop(quote.destination_amount.amount)} COP</strong>. Es
          un precio de referencia e incluye la comisión: lo que envíes de más también se paga.
          {settlementWindow(quote.settlement_time ?? withdrawal.settlement_time)
            ? ` Los pesos llegan ${settlementWindow(quote.settlement_time ?? withdrawal.settlement_time)} después de que recibimos el USDC.`
            : null}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm font-semibold text-co-red" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** The payouts made from the address, most recent first. */
export function PayoutList({
  withdrawalId,
  onSessionExpired,
}: {
  withdrawalId: string;
  onSessionExpired: () => void;
}) {
  const [payouts, setPayouts] = useState<Payout[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    ramp<Withdrawal>("GET", `v1/withdrawals/${withdrawalId}`).then(
      ({ data }) => active && setPayouts(data.payouts ?? []),
      (cause) => {
        if (!active) return;
        if (isSessionError(cause)) return onSessionExpired();
        setPayouts([]);
        setError(errorText(cause));
      },
    );
    return () => {
      active = false;
    };
  }, [withdrawalId, onSessionExpired]);

  if (payouts === null) return null;
  return (
    <div className="mt-6 max-w-xl">
      <p className="text-sm font-semibold text-ink">Tus retiros</p>
      {payouts.some((p) => payoutPhase(p.status) === "failed") ? (
        <p className="mt-2 text-sm text-muted">
          Un pago que no se pudo hacer no se reintenta solo. Antes de enviar de nuevo, revisa tu
          billetera de devolución: si el USDC no volvió, escríbenos con la fecha del envío.
        </p>
      ) : null}
      {payouts.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {error ?? "Aún no has enviado USDC a esta dirección."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
          {payouts.slice(0, 10).map((payout) => (
            <li key={payout.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-3">
              <span className="text-muted">
                {new Date(payout.created_at).toLocaleDateString("es-CO", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="font-semibold text-ink">
                {payout.destination_amount
                  ? `${formatCop(payout.destination_amount.amount)} COP`
                  : payout.amount
                    ? `${formatUsdc(payout.amount.amount) ?? payout.amount.amount} ${payout.amount.asset}`
                    : ""}
              </span>
              <span className={PAYOUT_TONE[payoutPhase(payout.status)]}>
                {PAYOUT_LABEL[payoutPhase(payout.status)]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
