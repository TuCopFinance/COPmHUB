"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { normalizeBreBKey } from "@/lib/offramp/breb";
import {
  activeWithdrawal,
  currentDestination,
  feePercent,
  formatCop,
} from "@/lib/offramp/flow";
import {
  DESTINATION_REJECTION,
  GENERIC_ERROR,
  SESSION_CODES,
} from "@/lib/offramp/messages";
import { RampError, ramp } from "@/components/offramp/api";
import { KeyHint, WaitPanel } from "@/components/offramp/parts";
import type { Destination, Withdrawal } from "@/components/offramp/types";
import {
  Field,
  headingClass,
  inputClass,
  primaryClass,
  secondaryClass,
} from "@/components/offramp/ui";
import { WalletConfirm } from "@/components/offramp/WalletConfirm";
import { PayoutList, QuoteCalculator } from "@/components/offramp/WithdrawTools";

// The Bre-B directory answers in about a minute.
const POLL_MS = 4000;
const POLL_LIMIT_MS = 3 * 60 * 1000;

/**
 * Off-ramp for a verified person: their own Bre-B key, then the reusable
 * withdrawal address. A returning person sees what they already have; nothing
 * is created twice.
 */
export function WithdrawSection({
  onSessionExpired,
  onActiveChange,
}: {
  onSessionExpired: () => void;
  onActiveChange: (active: boolean) => void;
}) {
  const [destinations, setDestinations] = useState<Destination[] | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breBKey, setBreBKey] = useState("");
  const [wantsOtherKey, setWantsOtherKey] = useState(false);
  const [rejected, setRejected] = useState<Destination | null>(null);
  const [pollExpired, setPollExpired] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollStarted = useRef<number | null>(null);

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

  const load = useCallback(async () => {
    try {
      const [dst, wdr] = await Promise.all([
        ramp<{ data: Destination[] }>("GET", "v1/destinations"),
        ramp<{ data: Withdrawal[] }>("GET", "v1/withdrawals"),
      ]);
      setDestinations(dst.data.data);
      setWithdrawals(wdr.data.data);
    } catch (cause) {
      fail(cause);
    }
  }, [fail]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const destination = destinations ? currentDestination(destinations, withdrawals) : null;
  // Any active address is shown, even when its Bre-B key is not in the list
  // (people who pre-registered before keep the address they already had).
  const withdrawal =
    activeWithdrawal(withdrawals, destination?.id ?? null) ?? activeWithdrawal(withdrawals, null);
  const payoutKey = withdrawal
    ? (destinations ?? []).find((d) => d.id === withdrawal.destination_id) ?? null
    : null;
  // A key just refused keeps the form on screen with the reason, even when an
  // older key would otherwise be shown.
  const showForm =
    wantsOtherKey || Boolean(rejected && destinations?.[0]?.id === rejected.id);

  useEffect(() => {
    onActiveChange(Boolean(withdrawal));
  }, [withdrawal, onActiveChange]);

  const upsert = (next: Destination) =>
    setDestinations((list) => [next, ...(list ?? []).filter((d) => d.id !== next.id)]);

  // Waits for the Bre-B directory while the key is pending.
  const pendingId = destination?.status === "pending" ? destination.id : null;
  useEffect(() => {
    if (!pendingId) {
      pollStarted.current = null;
      return;
    }
    pollStarted.current ??= Date.now();
    const timer = window.setInterval(async () => {
      if (pollStarted.current && Date.now() - pollStarted.current > POLL_LIMIT_MS) {
        setPollExpired(true);
        window.clearInterval(timer);
        return;
      }
      try {
        const { data } = await ramp<Destination>("GET", `v1/destinations/${pendingId}`);
        if (data.status === "rejected") {
          setRejected(data);
          track("offramp_key_rejected", { section: "offramp" });
        }
        if (data.status !== "pending") upsert(data);
      } catch (cause) {
        fail(cause);
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [pendingId, fail]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  };

  const saveKey = () =>
    run(async () => {
      const key = normalizeBreBKey(breBKey);
      setBreBKey(key);
      const { data } = await ramp<Destination>("POST", "v1/destinations", {
        ownership: "first_party",
        bre_b_key: key,
      });
      setBreBKey("");
      setRejected(data.status === "rejected" ? data : null);
      setPollExpired(false);
      setWantsOtherKey(false);
      upsert(data);
    });

  const confirmKey = (id: string) =>
    run(async () => {
      const { data } = await ramp<Destination>("POST", `v1/destinations/${id}/confirm`, {});
      track("offramp_key_confirmed", { section: "offramp" });
      upsert(data);
    });

  const createWithdrawal = (destinationId: string, returnAddress: string) =>
    run(async () => {
      const { data } = await ramp<Withdrawal>("POST", "v1/withdrawals", {
        destination_id: destinationId,
        return_address: returnAddress,
      });
      track("offramp_activated", { section: "offramp" });
      setWithdrawals((list) => [data, ...list.filter((w) => w.id !== data.id)]);
    });

  const checkAgain = () => {
    pollStarted.current = Date.now();
    setPollExpired(false);
    void load();
  };

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("No pudimos copiar la dirección. Selecciónala y cópiala a mano.");
    }
  };

  const errorLine = error ? (
    <p
      className="mt-5 rounded-xl border border-co-red/25 bg-[#fdf1f2] px-4 py-3 text-sm font-semibold text-co-red"
      role="alert"
    >
      {error}
    </p>
  ) : null;

  if (destinations === null) {
    return (
      <>
        <p className="text-sm text-muted" role="status">
          Cargando tu cuenta...
        </p>
        {errorLine}
      </>
    );
  }

  if (withdrawal) {
    const fee = feePercent(withdrawal.fee_bps);
    const minimum = formatCop(withdrawal.deposit.minimum_destination_amount?.amount);
    return (
      <>
        <p className="text-xs font-bold uppercase tracking-wide text-[#137211]">Activo</p>
        <h2 className={headingClass + " mt-2"}>Tu off-ramp ya está habilitado</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Esta es tu dirección de liquidación. Todo lo que envíes aquí se convierte a pesos
          y llega a tu llave Bre-B
          {payoutKey ? (
            <>
              {" "}
              <strong className="text-ink">
                {payoutKey.key_masked}
                {payoutKey.holder?.bank ? ` (${payoutKey.holder.bank})` : ""}
              </strong>
            </>
          ) : null}
          , normalmente en unos minutos.
        </p>

        <div className="mt-6 rounded-2xl border-2 border-co-red bg-[#fdf1f2] p-5" role="note">
          <p className="text-lg font-extrabold uppercase leading-snug tracking-tight text-co-red sm:text-2xl">
            Solo recibe USDC en la red Celo
          </p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-ink">
            No envíes otro token ni uses otra red. Lo que llegue distinto a USDC en Celo se
            puede perder y no lo podemos recuperar.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-bg p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Tu dirección de liquidación
          </p>
          <p className="mt-2 break-all font-mono text-[15px] font-bold text-ink">
            {withdrawal.deposit.address}
          </p>
          <button
            type="button"
            onClick={() => copyAddress(withdrawal.deposit.address)}
            className={primaryClass + " mt-4"}
          >
            {copied ? "Copiada" : "Copiar dirección"}
          </button>
        </div>

        <dl className="mt-5 grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted">Token</dt>
          <dd className="font-semibold text-ink">USDC</dd>
          <dt className="text-muted">Red</dt>
          <dd className="font-semibold text-ink">Celo</dd>
          <dt className="text-muted">Contrato de USDC</dt>
          <dd className="break-all font-mono text-[13px] font-semibold text-ink">
            {withdrawal.deposit.token_contract}
          </dd>
          {minimum ? (
            <>
              <dt className="text-muted">Mínimo por envío</dt>
              <dd className="font-semibold text-ink">el equivalente a {minimum} COP</dd>
            </>
          ) : null}
          {fee ? (
            <>
              <dt className="text-muted">Comisión</dt>
              <dd className="font-semibold text-ink">
                {fee}% más la tasa de cambio del momento
              </dd>
            </>
          ) : null}
          {withdrawal.return_address ? (
            <>
              <dt className="text-muted">Si un pago falla</dt>
              <dd className="break-all text-ink">
                el USDC vuelve a{" "}
                <span className="font-mono text-[13px] font-semibold">
                  {withdrawal.return_address}
                </span>
              </dd>
            </>
          ) : null}
        </dl>

        <p className="mt-5 max-w-prose text-sm leading-relaxed text-muted">
          La dirección es siempre la misma: guárdala y úsala cuando quieras. Haz primero un
          envío pequeño para confirmar que llega.
        </p>
        <QuoteCalculator withdrawal={withdrawal} onSessionExpired={onSessionExpired} />
        <PayoutList withdrawalId={withdrawal.id} onSessionExpired={onSessionExpired} />
        {errorLine}
      </>
    );
  }

  if (destination && !showForm && destination.status === "pending") {
    return (
      <>
        <h2 className={headingClass}>Estamos validando tu llave con el banco</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Llave Bre-B: <strong className="text-ink">{destination.key_masked}</strong>
        </p>
        {pollExpired ? (
          <>
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted" role="status">
              El banco aún no responde. Puedes revisar de nuevo en un momento o volver más
              tarde con tu correo.
            </p>
            <button type="button" onClick={checkAgain} className={secondaryClass + " mt-4"}>
              Revisar de nuevo
            </button>
          </>
        ) : (
          <WaitPanel
            title="Consultando el directorio Bre-B"
            body="Confirmamos que la cuenta está a tu nombre. Suele tardar alrededor de un minuto: no cierres esta página, avanza sola."
          />
        )}
        {errorLine}
      </>
    );
  }

  if (destination && !showForm && destination.status === "verified" && !destination.confirmed_at) {
    return (
      <>
        <h2 className={headingClass}>¿Es esta tu cuenta?</h2>
        <dl className="mt-5 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-2xl border border-line bg-bg p-5 text-sm">
          <dt className="text-muted">Banco</dt>
          <dd className="font-semibold text-ink">{destination.holder?.bank ?? "Sin dato"}</dd>
          <dt className="text-muted">Titular</dt>
          <dd className="font-semibold text-ink">{destination.holder?.name ?? "Sin dato"}</dd>
          <dt className="text-muted">Documento</dt>
          <dd className="font-semibold text-ink">
            {destination.holder?.document_last4
              ? `termina en ${destination.holder.document_last4}`
              : "Sin dato"}
          </dd>
          <dt className="text-muted">Llave</dt>
          <dd className="font-semibold text-ink">{destination.key_masked}</dd>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => confirmKey(destination.id)}
            className={primaryClass}
          >
            Sí, es mi cuenta
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setWantsOtherKey(true)}
            className={secondaryClass}
          >
            No, usar otra llave
          </button>
        </div>
        {errorLine}
      </>
    );
  }

  if (destination && !showForm && destination.status === "verified" && destination.confirmed_at) {
    return (
      <>
        <h2 className={headingClass}>¿A qué billetera devolvemos un pago fallido?</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Tu llave Bre-B{" "}
          <strong className="text-ink">
            {destination.key_masked}
            {destination.holder?.bank ? ` (${destination.holder.bank})` : ""}
          </strong>{" "}
          quedó lista. Si alguna vez un pago a esa cuenta falla, el USDC vuelve a tu
          billetera en la red Celo.
        </p>
        <WalletConfirm
          purpose="Usa una billetera tuya en la red Celo. Esta dirección no se puede cambiar después."
          busy={busy}
          onConfirm={(address) => createWithdrawal(destination.id, address)}
        />
        {errorLine}
      </>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        saveKey();
      }}
    >
      <h2 className={headingClass}>Registra tu llave Bre-B</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Tu identidad está verificada. Ahora escribe la llave Bre-B de una cuenta a tu
        nombre: celular, documento, correo o llave alfanumérica. No se aceptan cuentas de
        terceros.
      </p>
      {rejected ? (
        <p
          className="mt-4 max-w-prose rounded-xl border border-co-red/25 bg-[#fdf1f2] px-4 py-3 text-sm font-semibold text-co-red"
          role="alert"
        >
          No pudimos validar la llave {rejected.key_masked}.{" "}
          {(rejected.rejection_reason && DESTINATION_REJECTION[rejected.rejection_reason]) ??
            "Revisa que esté bien escrita y que la cuenta sea tuya."}
        </p>
      ) : null}
      <div className="mt-6 max-w-md">
        <Field label="Llave Bre-B">
          <input
            className={inputClass}
            value={breBKey}
            onChange={(event) => setBreBKey(event.target.value)}
            onBlur={() => setBreBKey((value) => normalizeBreBKey(value))}
            placeholder="@tullave, 3001234567 o tu@correo.com"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </Field>
        <KeyHint value={breBKey} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={primaryClass}>
          {busy ? "Enviando..." : "Validar llave"}
        </button>
        {wantsOtherKey ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setWantsOtherKey(false)}
            className={secondaryClass}
          >
            Volver
          </button>
        ) : null}
      </div>
      {errorLine}
    </form>
  );
}
