"use client";

import { useState } from "react";
import { checkWalletPair } from "@/lib/offramp/wallet";
import { Field, inputClass, primaryClass, secondaryClass } from "@/components/offramp/ui";

const REASONS = {
  empty: "Escribe la dirección en los dos campos.",
  invalid: "Una dirección de billetera empieza con 0x y tiene 40 letras o números más.",
  mismatch: "Las dos direcciones no coinciden. Revísalas.",
  bad_checksum: "La dirección tiene un error de escritura. Cópiala de nuevo desde tu billetera.",
} as const;

/**
 * The ramp only checks that a wallet is shaped like an address. This site
 * answers for it: typed twice (no pasting into the second field), compared,
 * shown checksummed, then confirmed by the person before anything is sent.
 */
export function WalletConfirm({
  purpose,
  busy,
  onConfirm,
}: {
  /** One line on what the wallet is for, shown above the fields. */
  purpose: string;
  busy: boolean;
  onConfirm: (address: string) => void;
}) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [checked, setChecked] = useState<string | null>(null);

  const review = () => {
    const result = checkWalletPair(first, second);
    if (!result.ok) {
      setProblem(REASONS[result.reason]);
      setChecked(null);
      return;
    }
    setProblem(null);
    setChecked(result.address);
  };

  if (checked) {
    return (
      <div className="mt-5 max-w-xl">
        <p className="text-sm font-semibold text-ink">
          ¿Confirmas que esta es tu billetera en la red Celo?
        </p>
        <p className="mt-3 break-all rounded-2xl border border-line bg-bg p-4 font-mono text-[15px] font-bold text-ink">
          {checked}
        </p>
        <div
          className="mt-4 rounded-2xl border-2 border-co-red bg-[#fdf1f2] p-4 text-sm font-semibold leading-relaxed text-ink"
          role="note"
        >
          Si la dirección está mal, la plata se pierde y no se puede recuperar.
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(checked)}
            className={primaryClass}
          >
            {busy ? "Guardando..." : "Sí, es mi billetera"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setChecked(null)}
            className={secondaryClass}
          >
            No, corregirla
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="mt-5 max-w-xl"
      onSubmit={(event) => {
        event.preventDefault();
        review();
      }}
    >
      <p className="text-sm leading-relaxed text-muted">{purpose}</p>
      <div className="mt-4 grid gap-4">
        <Field label="Dirección de tu billetera en la red Celo">
          <input
            className={inputClass + " font-mono"}
            value={first}
            onChange={(event) => setFirst(event.target.value)}
            placeholder="0x..."
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </Field>
        <Field label="Escríbela otra vez">
          <input
            className={inputClass + " font-mono"}
            value={second}
            onChange={(event) => setSecond(event.target.value)}
            onPaste={(event) => event.preventDefault()}
            onDrop={(event) => event.preventDefault()}
            placeholder="0x..."
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </Field>
      </div>
      <p className="mt-2 text-xs text-muted">
        En el segundo campo no se puede pegar: escríbela para comprobar que es la
        misma.
      </p>
      {problem ? (
        <p className="mt-3 text-sm font-semibold text-co-red" role="alert">
          {problem}
        </p>
      ) : null}
      <button type="submit" className={primaryClass + " mt-5"}>
        Revisar dirección
      </button>
    </form>
  );
}
