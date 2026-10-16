"use client";

import { useState } from "react";
import { feePercent, formatCop, settlementWindow } from "@/lib/offramp/flow";
import { WaitPanel } from "@/components/offramp/parts";
import type { Destination, Withdrawal } from "@/components/offramp/types";
import { primaryClass, secondaryClass } from "@/components/offramp/ui";
import { WalletConfirm } from "@/components/offramp/WalletConfirm";
import { PayoutList, QuoteCalculator } from "@/components/offramp/WithdrawTools";

/** "****1234 (Nequi)" for a key, or a neutral name when this app cannot see it. */
export function keyLabel(destination: Destination | null): string {
  if (!destination) return "tu llave Bre-B";
  const bank = destination.holder?.bank;
  const key = destination.key_masked ?? "tu llave Bre-B";
  return bank ? `${key} (${bank})` : key;
}

const linkClass = "text-sm font-semibold text-brand hover:underline disabled:opacity-50";

function HolderList({ destination }: { destination: Destination }) {
  return (
    <dl className="mt-4 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-2xl border border-line bg-bg p-5 text-sm">
      <dt className="text-muted">Llave</dt>
      <dd className="font-semibold text-ink">{destination.key_masked}</dd>
      <dt className="text-muted">Banco</dt>
      <dd className="font-semibold text-ink">{destination.holder?.bank ?? "Sin dato"}</dd>
      <dt className="text-muted">Titular</dt>
      <dd className="font-semibold text-ink">{destination.holder?.name ?? "Sin dato"}</dd>
      {destination.holder?.document_last4 ? (
        <>
          <dt className="text-muted">Documento</dt>
          <dd className="font-semibold text-ink">
            termina en {destination.holder.document_last4}
          </dd>
        </>
      ) : null}
    </dl>
  );
}

/** A key the Bre-B directory is still checking. */
export function PendingKeyCard({
  destination,
  expired,
  onCheckAgain,
}: {
  destination: Destination;
  expired: boolean;
  onCheckAgain: () => void;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-line p-5">
      <p className="text-sm font-semibold text-ink">
        Validando la llave {destination.key_masked} con el banco
      </p>
      {expired ? (
        <>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted" role="status">
            El banco aún no responde. Puedes revisar de nuevo en un momento o volver más tarde
            con tu correo.
          </p>
          <button type="button" onClick={onCheckAgain} className={secondaryClass + " mt-4"}>
            Revisar de nuevo
          </button>
        </>
      ) : (
        <WaitPanel
          title="Consultando el directorio Bre-B"
          body="Confirmamos que la cuenta está a tu nombre. Suele tardar alrededor de un minuto: no cierres esta página, avanza sola."
        />
      )}
    </section>
  );
}

/** A verified key without an address yet: the person picks the return wallet. */
export function ReadyKeyCard({
  destination,
  busy,
  onRemove,
  onCreate,
}: {
  destination: Destination;
  busy: boolean;
  onRemove: () => void;
  onCreate: (returnAddress: string) => void;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-line p-5">
      <p className="text-sm font-semibold text-ink">¿A qué billetera devolvemos un pago fallido?</p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        El banco confirmó que esta llave Bre-B está a tu nombre. Los pesos de tus ventas llegan
        a esta cuenta:
      </p>
      <HolderList destination={destination} />
      <button type="button" disabled={busy} onClick={onRemove} className={linkClass + " mt-3"}>
        No es mi cuenta, quitar esta llave
      </button>
      <p className="mt-6 max-w-prose text-sm leading-relaxed text-muted">
        Si alguna vez un pago a esa cuenta falla, el USDC vuelve a tu billetera en la red Celo.
      </p>
      <WalletConfirm
        purpose="Usa una billetera tuya en la red Celo. Esta dirección no se puede cambiar mientras la dirección de liquidación esté activa."
        busy={busy}
        onConfirm={onCreate}
      />
    </section>
  );
}

/** An active withdrawal address and what goes with it. */
export function AddressCard({
  entry,
  busy,
  onDisable,
  onSessionExpired,
}: {
  entry: { destination: Destination | null; withdrawal: Withdrawal };
  busy: boolean;
  onDisable: () => void;
  onSessionExpired: () => void;
}) {
  const { destination, withdrawal } = entry;
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const fee = feePercent(withdrawal.fee_bps);
  const minimum = formatCop(withdrawal.deposit.minimum_destination_amount?.amount);
  const arrival = settlementWindow(withdrawal.settlement_time);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(withdrawal.deposit.address);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-line p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-[#137211]">Activa</p>
      <p className="mt-1 text-base font-bold text-ink">Llave {keyLabel(destination)}</p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Todo lo que envíes a esta dirección se convierte a pesos y llega solo a esta llave
        {arrival ? `, ${arrival} después de que recibimos el USDC` : ", normalmente en unos minutos"}.
      </p>

      <div className="mt-4 rounded-2xl border border-line bg-bg p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Dirección de liquidación
        </p>
        <p className="mt-2 break-all font-mono text-[15px] font-bold text-ink">
          {withdrawal.deposit.address}
        </p>
        <button type="button" onClick={copy} className={primaryClass + " mt-4"}>
          {copied ? "Copiada" : "Copiar dirección"}
        </button>
        {copyFailed ? (
          <p className="mt-3 text-sm font-semibold text-co-red" role="alert">
            No pudimos copiar la dirección. Selecciónala y cópiala a mano.
          </p>
        ) : null}
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
            <dd className="font-semibold text-ink">{fee}% más la tasa de cambio del momento</dd>
          </>
        ) : null}
        {arrival ? (
          <>
            <dt className="text-muted">Tiempo de llegada</dt>
            <dd className="font-semibold text-ink">{arrival} después de recibir el USDC</dd>
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

      <QuoteCalculator withdrawal={withdrawal} onSessionExpired={onSessionExpired} />
      <PayoutList withdrawalId={withdrawal.id} onSessionExpired={onSessionExpired} />

      <div className="mt-6 border-t border-line pt-4">
        {confirming ? (
          <div className="max-w-prose rounded-xl border border-co-red/25 bg-[#fdf1f2] p-4" role="alert">
            <p className="text-sm font-semibold text-co-red">¿Deshabilitar esta dirección?</p>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              Deja de mostrarse aquí y no debes volver a enviar a ella. Si alguien envía USDC a
              esta dirección después, igual se paga a la llave {keyLabel(destination)}: no se
              devuelve. La puedes reactivar cuando quieras.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  onDisable();
                }}
                className={primaryClass}
              >
                Sí, deshabilitar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className={secondaryClass}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
            className={linkClass}
          >
            Deshabilitar esta dirección
          </button>
        )}
      </div>
    </section>
  );
}

/** Disabled addresses: shown so the person knows not to send to them. */
export function DisabledList({
  entries,
  busy,
  canAddKey,
  onEnable,
  onRemoveKey,
}: {
  entries: { destination: Destination | null; withdrawal: Withdrawal | null }[];
  busy: boolean;
  /** False at the active-key limit: re-enabling a removed key would need a free slot. */
  canAddKey: boolean;
  onEnable: (destinationId: string) => void;
  onRemoveKey: (destinationId: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-10">
      <h3 className="text-base font-bold text-ink">Deshabilitadas</h3>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
        No envíes USDC a estas direcciones. Si llega algo, igual se paga a su llave.
      </p>
      <ul className="mt-4 space-y-3">
        {entries.map(({ destination, withdrawal }) => {
          if (!withdrawal) return null;
          const removed = destination?.active === false;
          return (
            <li
              key={withdrawal.id}
              className="rounded-2xl border border-line bg-bg p-4 text-sm text-muted"
            >
              <p className="font-semibold text-ink">
                Llave {keyLabel(destination)}
                {removed ? " · llave quitada" : ""}
              </p>
              <p className="mt-1 break-all font-mono text-[13px] line-through">
                {withdrawal.deposit.address}
              </p>
              {withdrawal.disabled_at ? (
                <p className="mt-1">
                  Deshabilitada el{" "}
                  {new Date(withdrawal.disabled_at).toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              ) : null}
              {destination && !removed ? (
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onEnable(destination.id)}
                    className={linkClass}
                  >
                    Reactivar esta dirección
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRemoveKey(destination.id)}
                    className={linkClass}
                  >
                    Quitar esta llave
                  </button>
                </div>
              ) : removed ? (
                <p className="mt-2">
                  {canAddKey
                    ? "Para usarla otra vez, registra la misma llave: recupera esta dirección."
                    : "Para usarla otra vez, quita otra llave y registra esta de nuevo."}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
