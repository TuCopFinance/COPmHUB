"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { normalizeBreBKey } from "@/lib/offramp/breb";
import { MAX_ACTIVE_KEYS, groupKeys } from "@/lib/offramp/flow";
import {
  DESTINATION_REJECTION,
  GENERIC_ERROR,
  SESSION_CODES,
} from "@/lib/offramp/messages";
import { RampError, ramp } from "@/components/offramp/api";
import {
  AddressCard,
  DisabledList,
  PendingKeyCard,
  ReadyKeyCard,
} from "@/components/offramp/KeyCards";
import { KeyHint } from "@/components/offramp/parts";
import type { Destination, Withdrawal } from "@/components/offramp/types";
import {
  Field,
  headingClass,
  inputClass,
  primaryClass,
  secondaryClass,
} from "@/components/offramp/ui";

// The Bre-B directory answers in about a minute.
const POLL_MS = 4000;
const POLL_LIMIT_MS = 3 * 60 * 1000;

/**
 * Off-ramp for a verified person: their own Bre-B keys (up to
 * MAX_ACTIVE_KEYS), each with its own withdrawal address. A returning person
 * sees what they already have; nothing is created twice. Disabled addresses
 * stay listed so the person knows not to send to them.
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
  const [rejected, setRejected] = useState<Destination | null>(null);
  const [adding, setAdding] = useState(false);
  const [pollExpired, setPollExpired] = useState(false);
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
        ramp<{ data: Destination[] }>("GET", "v1/destinations?include_disabled=true"),
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

  const groups = groupKeys(destinations ?? [], withdrawals);
  const hasAnything =
    groups.active.length + groups.ready.length + groups.pending.length + groups.disabled.length > 0;
  const atLimit = groups.activeKeyCount >= MAX_ACTIVE_KEYS;
  // The form shows for the first key, when the person asks for another, and
  // while a key just refused is on screen with its reason.
  const showForm = !atLimit && (!hasAnything || adding || rejected !== null);
  const anyActive = groups.active.length > 0;

  useEffect(() => {
    onActiveChange(anyActive);
  }, [anyActive, onActiveChange]);

  const upsertDestination = (next: Destination) =>
    setDestinations((list) => [next, ...(list ?? []).filter((d) => d.id !== next.id)]);
  const upsertWithdrawal = (next: Withdrawal) =>
    setWithdrawals((list) => [next, ...list.filter((w) => w.id !== next.id)]);

  // Waits for the Bre-B directory while any key is pending.
  const pendingIds = groups.pending.map((d) => d.id).join(",");
  useEffect(() => {
    if (!pendingIds) {
      pollStarted.current = null;
      return;
    }
    pollStarted.current ??= Date.now();
    const ids = pendingIds.split(",");
    const timer = window.setInterval(async () => {
      if (pollStarted.current && Date.now() - pollStarted.current > POLL_LIMIT_MS) {
        setPollExpired(true);
        window.clearInterval(timer);
        return;
      }
      try {
        for (const id of ids) {
          const { data } = await ramp<Destination>("GET", `v1/destinations/${id}`);
          if (data.status === "pending") continue;
          if (data.status === "rejected") {
            setRejected(data);
            track("offramp_key_rejected", { section: "offramp" });
          }
          upsertDestination(data);
        }
      } catch (cause) {
        fail(cause);
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [pendingIds, fail]);

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
      setAdding(false);
      setPollExpired(false);
      upsertDestination(data);
      track("offramp_key_added", { section: "offramp" });
      // A key removed before comes back with its disabled address.
      if (data.status === "verified") await load();
    });

  // Not allowed while the key has an active address (409 destination_in_use).
  const removeKey = (id: string) =>
    run(async () => {
      await ramp<null>("DELETE", `v1/destinations/${id}`);
      track("offramp_key_removed", { section: "offramp" });
      setRejected(null);
      await load();
    });

  const createWithdrawal = (destinationId: string, returnAddress: string) =>
    run(async () => {
      const { data } = await ramp<Withdrawal>("POST", "v1/withdrawals", {
        destination_id: destinationId,
        return_address: returnAddress,
      });
      track("offramp_activated", { section: "offramp" });
      upsertWithdrawal(data);
    });

  // Re-enables the same address; it keeps its return wallet.
  const enableWithdrawal = (destinationId: string) =>
    run(async () => {
      const { data } = await ramp<Withdrawal>("POST", "v1/withdrawals", {
        destination_id: destinationId,
      });
      track("offramp_address_enabled", { section: "offramp" });
      upsertWithdrawal(data);
    });

  const disableWithdrawal = (id: string) =>
    run(async () => {
      const { data } = await ramp<Withdrawal>("DELETE", `v1/withdrawals/${id}`);
      track("offramp_address_disabled", { section: "offramp" });
      upsertWithdrawal(data);
    });

  const checkAgain = () => {
    pollStarted.current = Date.now();
    setPollExpired(false);
    void load();
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

  const keyForm = (
    <form
      className={hasAnything ? "mt-6 rounded-2xl border border-line p-5" : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        saveKey();
      }}
    >
      {hasAnything ? (
        <p className="text-base font-bold text-ink">Agregar otra llave Bre-B</p>
      ) : (
        <h2 className={headingClass}>Registra tu llave Bre-B</h2>
      )}
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        {hasAnything
          ? `Cada llave tiene su propia dirección de liquidación. Puedes tener hasta ${MAX_ACTIVE_KEYS} llaves activas. `
          : "Tu identidad está verificada. "}
        Escribe la llave Bre-B de una cuenta a tu nombre: celular, documento, correo o llave
        alfanumérica. No se aceptan cuentas de terceros.
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
        {hasAnything ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setAdding(false);
              setRejected(null);
              setBreBKey("");
            }}
            className={secondaryClass}
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );

  if (!hasAnything) {
    return (
      <>
        {keyForm}
        {errorLine}
      </>
    );
  }

  return (
    <>
      {anyActive ? (
        <>
          <p className="text-xs font-bold uppercase tracking-wide text-[#137211]">Activo</p>
          <h2 className={headingClass + " mt-2"}>Tu off-ramp ya está habilitado</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Cada llave Bre-B tiene su propia dirección de liquidación. Lo que envíes a una
            dirección llega solo a su llave. Las direcciones son siempre las mismas: guárdalas y
            úsalas cuando quieras. Haz primero un envío pequeño para confirmar que llega.
          </p>
          <div className="mt-6 rounded-2xl border-2 border-co-red bg-[#fdf1f2] p-5" role="note">
            <p className="text-lg font-extrabold uppercase leading-snug tracking-tight text-co-red sm:text-2xl">
              Solo reciben USDC en la red Celo
            </p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-ink">
              No envíes otro token ni uses otra red. Lo que llegue distinto a USDC en Celo se
              puede perder y no lo podemos recuperar.
            </p>
          </div>
        </>
      ) : (
        <h2 className={headingClass}>Tus llaves Bre-B</h2>
      )}

      {groups.pending.map((d) => (
        <PendingKeyCard
          key={d.id}
          destination={d}
          expired={pollExpired}
          onCheckAgain={checkAgain}
        />
      ))}
      {groups.ready.map((d) => (
        <ReadyKeyCard
          key={d.id}
          destination={d}
          busy={busy}
          onRemove={() => removeKey(d.id)}
          onCreate={(address) => createWithdrawal(d.id, address)}
        />
      ))}
      {groups.active.map((entry) =>
        entry.withdrawal ? (
          <AddressCard
            key={entry.withdrawal.id}
            entry={{ destination: entry.destination, withdrawal: entry.withdrawal }}
            busy={busy}
            onDisable={() => disableWithdrawal(entry.withdrawal!.id)}
            onSessionExpired={onSessionExpired}
          />
        ) : null,
      )}

      {errorLine}

      {showForm ? (
        keyForm
      ) : atLimit ? (
        <p className="mt-6 max-w-prose text-sm leading-relaxed text-muted">
          Tienes {MAX_ACTIVE_KEYS} llaves Bre-B activas, el máximo. Para agregar otra, deshabilita
          la dirección de una y quita esa llave.
        </p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setAdding(true);
            setError(null);
          }}
          className={secondaryClass + " mt-6"}
        >
          Agregar otra llave Bre-B
        </button>
      )}

      <DisabledList
        entries={groups.disabled}
        busy={busy}
        canAddKey={!atLimit}
        onEnable={enableWithdrawal}
        onRemoveKey={removeKey}
      />
    </>
  );
}
