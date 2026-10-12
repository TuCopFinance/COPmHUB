"use client";

import { useCallback, useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { activeDeposit, feePercent, formatCop, formatUsdc } from "@/lib/offramp/flow";
import { GENERIC_ERROR, SESSION_CODES } from "@/lib/offramp/messages";
import { RampError, ramp } from "@/components/offramp/api";
import type { Deposit, DepositEvent } from "@/components/offramp/types";
import { headingClass, primaryClass } from "@/components/offramp/ui";
import { WalletConfirm } from "@/components/offramp/WalletConfirm";

/**
 * On-ramp for a verified person: a Bre-B key issued for them. Pesos paid
 * there arrive as USDC on Celo in their wallet. Shown once identity
 * verification is approved; a returning person sees the key they have.
 */
export function DepositCard({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [deposits, setDeposits] = useState<Deposit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fail = useCallback(
    (cause: unknown) => {
      if (cause instanceof RampError && cause.code && SESSION_CODES.has(cause.code)) {
        onSessionExpired();
        return;
      }
      setError(cause instanceof RampError ? cause.message : GENERIC_ERROR);
    },
    [onSessionExpired],
  );

  useEffect(() => {
    let active = true;
    ramp<{ data: Deposit[] }>("GET", "v1/deposits").then(
      ({ data }) => active && setDeposits(data.data),
      (cause) => {
        if (!active) return;
        setDeposits([]);
        fail(cause);
      },
    );
    return () => {
      active = false;
    };
  }, [fail]);

  const create = async (wallet: string) => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await ramp<Deposit>("POST", "v1/deposits", { wallet_address: wallet });
      track("onramp_activated", { section: "offramp" });
      setDeposits((list) => [data, ...(list ?? []).filter((d) => d.id !== data.id)]);
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("No pudimos copiar la llave. Selecciónala y cópiala a mano.");
    }
  };

  const deposit = deposits ? activeDeposit(deposits) : null;
  const fee = feePercent(deposit?.fee_bps ?? 150) ?? "1,5";

  return (
    <div className="mt-6 rounded-[20px] border border-line bg-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-wide text-brand">On-ramp</p>
      <h2 className={headingClass + " mt-2"}>Compra USDC con pesos</h2>

      {deposits === null ? (
        <p className="mt-3 text-sm text-muted" role="status">
          Cargando...
        </p>
      ) : deposit ? (
        <>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Envía pesos por Bre-B a esta llave. Recibes USDC en tu billetera en la red Celo
            en minutos. Comisión {fee}%.
          </p>
          <div className="mt-5 rounded-2xl border border-line bg-bg p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Llave Bre-B para pagar
            </p>
            <p className="mt-2 break-all font-mono text-lg font-bold text-ink">
              {deposit.deposit_instructions.bre_b_key}
            </p>
            <button
              type="button"
              onClick={() => copyKey(deposit.deposit_instructions.bre_b_key)}
              className={primaryClass + " mt-4"}
            >
              {copied ? "Copiada" : "Copiar llave"}
            </button>
          </div>
          <dl className="mt-5 grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted">Titular</dt>
            <dd className="font-semibold text-ink">
              {deposit.deposit_instructions.account_holder_name ?? "Sin dato"}
            </dd>
            <dt className="text-muted">Banco</dt>
            <dd className="font-semibold text-ink">
              {deposit.deposit_instructions.bank_name ?? "Sin dato"}
            </dd>
            <dt className="text-muted">Recibes</dt>
            <dd className="font-semibold text-ink">USDC en la red Celo</dd>
            <dt className="text-muted">En tu billetera</dt>
            <dd className="break-all font-mono text-[13px] font-semibold text-ink">
              {deposit.destination.address}
            </dd>
          </dl>
          <DepositHistory depositId={deposit.id} />
          <p className="mt-5 max-w-prose text-sm leading-relaxed text-muted">
            Paga desde una cuenta bancaria a tu nombre. La llave es siempre la misma: úsala
            cada vez que quieras comprar. Haz primero un pago pequeño para confirmar que
            llega.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Te damos una llave Bre-B solo para ti. Los pesos que envíes ahí llegan como USDC
            a tu billetera en la red Celo en minutos. Comisión {fee}%.
          </p>
          <WalletConfirm
            purpose="¿A qué billetera enviamos los USDC? Usa una billetera tuya en la red Celo."
            busy={busy}
            onConfirm={create}
          />
        </>
      )}

      {error ? (
        <p
          className="mt-5 rounded-xl border border-co-red/25 bg-[#fdf1f2] px-4 py-3 text-sm font-semibold text-co-red"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function eventAmount(event: DepositEvent): string {
  if (!event.amount) return "";
  if (event.amount.asset === "COP") return `${formatCop(event.amount.amount) ?? event.amount.amount} COP`;
  return `${formatUsdc(event.amount.amount) ?? event.amount.amount} ${event.amount.asset}`;
}

/** What has happened on the account: pesos received, USDC sent. */
function DepositHistory({ depositId }: { depositId: string }) {
  const [events, setEvents] = useState<DepositEvent[] | null>(null);

  useEffect(() => {
    let active = true;
    ramp<Deposit>("GET", `v1/deposits/${depositId}`).then(
      ({ data }) => active && setEvents(data.events ?? []),
      () => active && setEvents([]),
    );
    return () => {
      active = false;
    };
  }, [depositId]);

  if (events === null) return null;
  return (
    <div className="mt-6 max-w-xl">
      <p className="text-sm font-semibold text-ink">Tus compras</p>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          Aún no has pagado a esta llave. Aparece aquí unos minutos después de que llegan
          los pesos.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
          {events.slice(0, 10).map((event) => (
            <li key={event.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-3">
              <span className="text-muted">
                {event.created_at
                  ? new Date(event.created_at).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : ""}
              </span>
              <span className="font-semibold text-ink">{eventAmount(event)}</span>
              <span className="text-muted">
                {event.amount?.asset === "COP" ? "Pesos recibidos" : "USDC enviado"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
