"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import {
  DOCUMENT_TYPES,
  GENERIC_ERROR,
  SESSION_EXPIRED_CODE,
  offrampErrorMessage,
} from "@/lib/offramp/messages";
import { markOfframpPopupSeen } from "@/components/offramp/popupStorage";
import {
  readSessionToken,
  writeSessionToken,
} from "@/components/offramp/session";

type Destination = {
  key_masked: string | null;
  bank: string | null;
  holder: string | null;
  document_last4: string | null;
};

type Offramp = {
  address: string;
  chain: string;
  currency: string;
  token_address: string;
  destination_currency: string;
  developer_fee_percent: string;
  min_payout_cop: number;
};

type State =
  | "signed_out"
  | "new"
  | "kyc_pending"
  | "kyc_approved"
  | "destination_pending"
  | "destination_verified"
  | "rejected"
  | "restricted";

type Status = {
  state: State;
  email?: string;
  kyc_link?: string | null;
  tos_link?: string | null;
  kyc_status?: string | null;
  tos_status?: string | null;
  destination?: Destination | null;
  offramp?: Offramp | null;
};

const SIGNED_OUT: Status = { state: "signed_out" };

class ApiError extends Error {
  constructor(readonly code: string | undefined) {
    super(offrampErrorMessage(code));
  }
}

const STEPS = ["Correo", "Tus datos", "Identidad", "Llave Bre-B", "Listo"];

function stepIndex(state: State): number {
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

const inputClass =
  "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/20";
const primaryClass =
  "inline-flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-50";
const secondaryClass =
  "inline-flex items-center justify-center rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink transition-colors hover:border-brand/40 disabled:opacity-50";
const headingClass =
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

function Stepper({ current }: { current: number }) {
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

function StatusLine({ label, done }: { label: string; done: boolean }) {
  return (
    <span className="flex items-center gap-2 text-sm">
      <span
        className={"h-2 w-2 rounded-full " + (done ? "bg-[#137211]" : "bg-gold")}
        aria-hidden="true"
      />
      <span className="text-muted">
        {label}:{" "}
        <strong className="text-ink">{done ? "Listo" : "Pendiente"}</strong>
      </span>
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-ink">
      {label}
      {children}
    </label>
  );
}

export function OfframpFlow({
  apiUrl,
  dataController,
  privacyContact,
}: {
  apiUrl: string;
  dataController: string;
  privacyContact: string;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0].value);
  const [documentNumber, setDocumentNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [breBKey, setBreBKey] = useState("");
  const [copied, setCopied] = useState(false);

  const token = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Personal data goes from the browser straight to TuCOPRamp. This site's
  // server never sees it.
  const call = useCallback(
    async <T,>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> => {
      const headers: Record<string, string> = {};
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (token.current) headers.Authorization = `Bearer ${token.current}`;

      let response: Response;
      try {
        response = await fetch(`${apiUrl}/v1/prereg${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          cache: "no-store",
        });
      } catch {
        throw new ApiError(undefined);
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (data?.code === SESSION_EXPIRED_CODE) {
          token.current = null;
          writeSessionToken(null);
          setStatus(SIGNED_OUT);
        }
        throw new ApiError(data?.code);
      }
      return data as T;
    },
    [apiUrl],
  );

  useEffect(() => {
    let active = true;
    token.current = readSessionToken();
    if (!token.current) {
      // Deferred so the first paint matches the server render.
      queueMicrotask(() => active && setStatus(SIGNED_OUT));
      return () => {
        active = false;
      };
    }
    call<Status>("GET", "/me").then(
      (next) => active && setStatus(next),
      () => active && setStatus(SIGNED_OUT),
    );
    return () => {
      active = false;
    };
  }, [call]);

  // While Bridge reviews the identity, or while the withdrawal address is
  // still being created, poll so the page moves on by itself.
  const waiting =
    status?.state === "kyc_pending" ||
    (status?.state === "destination_verified" && !status.offramp);
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      call<Status>("GET", "/me").then(setStatus, () => {});
    }, 8000);
    return () => window.clearInterval(timer);
  }, [waiting, call]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }, []);

  const advance = (next: Status) => {
    setStatus(next);
    headingRef.current?.focus();
  };

  const sendCode = () =>
    run(async () => {
      const issued = await call<{ challenge_id: string }>("POST", "/email-otp", {
        email,
      });
      setChallengeId(issued.challenge_id);
      setNotice("Te enviamos un código de 6 dígitos. Revisa también el spam.");
    });

  const verify = () =>
    run(async () => {
      const result = await call<Status & { session_token: string }>(
        "POST",
        "/email-otp/verify",
        { challenge_id: challengeId, otp: code },
      );
      token.current = result.session_token;
      writeSessionToken(result.session_token);
      markOfframpPopupSeen();
      setChallengeId(null);
      setCode("");
      track("offramp_email_verified", { section: "offramp" });
      advance(result);
    });

  const start = () =>
    run(async () => {
      const next = await call<Status>("POST", "/start", {
        full_name: fullName,
        document_type: documentType,
        document_number: documentNumber,
        consent,
      });
      setDocumentNumber("");
      track("offramp_kyc_started", { section: "offramp" });
      advance(next);
    });

  const saveKey = () =>
    run(async () => {
      // The Bre-B directory answers after a wait; say so, or it looks stuck.
      setNotice("Estamos validando tu llave con el banco. Puede tardar hasta un minuto y medio: no cierres esta página.");
      const next = await call<Status>("POST", "/destination", {
        bre_b_key: breBKey,
      });
      setBreBKey("");
      setNotice(null);
      advance(next);
    });

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("No pudimos copiar la dirección. Selecciónala y cópiala a mano.");
    }
  };

  const confirmKey = (accept: boolean) =>
    run(async () => {
      const next = await call<Status>("POST", "/destination/confirm", { accept });
      if (accept) track("offramp_preregistered", { section: "offramp" });
      if (accept && next.offramp) track("offramp_activated", { section: "offramp" });
      advance(next);
    });

  const signOut = () => {
    token.current = null;
    writeSessionToken(null);
    setEmail("");
    setFullName("");
    setDocumentNumber("");
    setConsent(false);
    setChallengeId(null);
    setCode("");
    setError(null);
    setNotice(null);
    setStatus(SIGNED_OUT);
  };

  if (!status) {
    return (
      <div className="rounded-[20px] border border-line bg-white p-6 sm:p-8">
        <p className="text-sm text-muted" role="status">
          Cargando...
        </p>
      </div>
    );
  }

  const state = status.state;
  const codeSent = challengeId !== null;
  const heading = (text: string) => (
    <h2 ref={headingRef} tabIndex={-1} className={headingClass}>
      {text}
    </h2>
  );

  return (
    <div className="rounded-[20px] border border-line bg-white p-6 sm:p-8">
      <Stepper current={stepIndex(state)} />

      <div className="mt-8" aria-live="polite">
        {state === "signed_out" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (codeSent) verify();
              else sendCode();
            }}
          >
            {heading("Empieza con tu correo")}
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              Te enviamos un código para confirmar que es tuyo. Si ya empezaste
              tu preinscripción, con el mismo correo la retomas donde la
              dejaste.
            </p>
            <div className="mt-6 grid max-w-md gap-4">
              <Field label="Correo">
                <input
                  className={inputClass}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={codeSent}
                />
              </Field>
              {codeSent ? (
                <Field label="Código de 6 dígitos">
                  <input
                    className={inputClass + " tracking-[0.3em]"}
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    required
                  />
                </Field>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="submit" disabled={busy} className={primaryClass}>
                {codeSent ? "Confirmar código" : "Enviar código"}
              </button>
              {codeSent ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setChallengeId(null);
                    setCode("");
                    setNotice(null);
                    setError(null);
                  }}
                  className={secondaryClass}
                >
                  Cambiar correo
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        {state === "new" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              start();
            }}
          >
            {heading("Tus datos")}
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              Usa tu nombre y tu documento tal como aparecen en tu
              identificación. La cuenta Bre-B que registres después debe estar
              a ese mismo nombre y documento.
            </p>
            <div className="mt-6 grid max-w-md gap-4">
              <Field label="Nombre completo">
                <input
                  className={inputClass}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                <Field label="Tipo de documento">
                  <select
                    className={inputClass}
                    value={documentType}
                    onChange={(event) => setDocumentType(event.target.value)}
                  >
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Número de documento">
                  <input
                    className={inputClass}
                    value={documentNumber}
                    onChange={(event) => setDocumentNumber(event.target.value)}
                    inputMode={documentType === "PAS" ? "text" : "numeric"}
                    autoComplete="off"
                    required
                  />
                </Field>
              </div>
              <label className="flex items-start gap-3 text-sm leading-relaxed text-muted">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#174bff]"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  required
                />
                <span>
                  Autorizo a {dataController} a tratar mis datos personales
                  para verificar mi identidad y prestar el servicio de
                  off-ramp, y a compartirlos con Bridge, su proveedor de
                  verificación y pagos, según el{" "}
                  <a
                    href="/privacidad#off-ramp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand underline"
                  >
                    aviso de privacidad
                  </a>
                  .
                </span>
              </label>
            </div>
            <button
              type="submit"
              disabled={busy || !consent}
              className={primaryClass + " mt-6"}
            >
              Continuar
            </button>
          </form>
        ) : null}

        {state === "kyc_pending" ? (
          <>
            {heading("Verifica tu identidad")}
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              Son dos pasos en la página segura de Bridge, nuestro proveedor.
              Ten a la mano tu documento. Puedes cerrar esta página y volver
              después con tu correo: tu avance queda guardado.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {status.kyc_link ? (
                <a
                  href={status.kyc_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={primaryClass}
                >
                  Verificar identidad
                </a>
              ) : null}
              {status.tos_link && status.tos_status !== "approved" ? (
                <a
                  href={status.tos_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={secondaryClass}
                >
                  Aceptar términos
                </a>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              <StatusLine
                label="Identidad"
                done={
                  status.kyc_status === "approved" ||
                  status.kyc_status === "active"
                }
              />
              <StatusLine
                label="Términos"
                done={status.tos_status === "approved"}
              />
            </div>
            <p className="mt-4 text-sm text-muted" role="status">
              {status.kyc_status === "under_review"
                ? "En revisión. Esta página se actualiza sola cuando haya respuesta."
                : "Esta página se actualiza sola cuando termines."}
            </p>
          </>
        ) : null}

        {state === "kyc_approved" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveKey();
            }}
          >
            {heading("Registra tu llave Bre-B")}
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              Tu identidad está verificada. Ahora escribe la llave Bre-B de una
              cuenta a tu nombre: celular, documento, correo o llave
              alfanumérica. No se aceptan cuentas de terceros.
            </p>
            <div className="mt-6 max-w-md">
              <Field label="Llave Bre-B">
                <input
                  className={inputClass}
                  value={breBKey}
                  onChange={(event) => setBreBKey(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </Field>
            </div>
            <button
              type="submit"
              disabled={busy}
              className={primaryClass + " mt-6"}
            >
              {busy ? "Validando..." : "Validar llave"}
            </button>
          </form>
        ) : null}

        {state === "destination_pending" && status.destination ? (
          <>
            {heading("¿Es esta tu cuenta?")}
            <dl className="mt-5 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-2xl border border-line bg-bg p-5 text-sm">
              <dt className="text-muted">Banco</dt>
              <dd className="font-semibold text-ink">
                {status.destination.bank ?? "Sin dato"}
              </dd>
              <dt className="text-muted">Titular</dt>
              <dd className="font-semibold text-ink">
                {status.destination.holder ?? "Sin dato"}
              </dd>
              <dt className="text-muted">Documento</dt>
              <dd className="font-semibold text-ink">
                {status.destination.document_last4
                  ? `termina en ${status.destination.document_last4}`
                  : "Sin dato"}
              </dd>
              <dt className="text-muted">Llave</dt>
              <dd className="font-semibold text-ink">
                {status.destination.key_masked}
              </dd>
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => confirmKey(true)}
                className={primaryClass}
              >
                Sí, es mi cuenta
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => confirmKey(false)}
                className={secondaryClass}
              >
                No, usar otra llave
              </button>
            </div>
          </>
        ) : null}

        {state === "destination_verified" && status.offramp ? (
          <>
            <p className="text-xs font-bold uppercase tracking-wide text-[#137211]">
              Activo
            </p>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className={headingClass + " mt-2"}
            >
              Tu off-ramp ya está habilitado
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              Esta es tu dirección de liquidación. Todo lo que envíes aquí se
              convierte a pesos y llega a tu llave Bre-B
              {status.destination?.key_masked ? (
                <>
                  {" "}
                  <strong className="text-ink">
                    {status.destination.key_masked}
                    {status.destination.bank
                      ? ` (${status.destination.bank})`
                      : ""}
                  </strong>
                </>
              ) : null}
              , normalmente en unos minutos.
            </p>

            <div
              className="mt-6 rounded-2xl border-2 border-co-red bg-[#fdf1f2] p-5"
              role="note"
            >
              <p className="text-lg font-extrabold uppercase leading-snug tracking-tight text-co-red sm:text-2xl">
                Solo recibe USDC en la red Celo
              </p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-ink">
                No envíes otro token ni uses otra red. Lo que llegue distinto a
                USDC en Celo se puede perder y no lo podemos recuperar.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-line bg-bg p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Tu dirección de liquidación
              </p>
              <p className="mt-2 break-all font-mono text-[15px] font-bold text-ink">
                {status.offramp.address}
              </p>
              <button
                type="button"
                onClick={() => copyAddress(status.offramp!.address)}
                className={primaryClass + " mt-4"}
              >
                {copied ? "Copiada" : "Copiar dirección"}
              </button>
            </div>

            <dl className="mt-5 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-muted">Token</dt>
              <dd className="font-semibold text-ink">USDC</dd>
              <dt className="text-muted">Red</dt>
              <dd className="font-semibold text-ink">Celo</dd>
              <dt className="text-muted">Contrato de USDC</dt>
              <dd className="break-all font-mono text-[13px] font-semibold text-ink">
                {status.offramp.token_address}
              </dd>
              <dt className="text-muted">Mínimo por envío</dt>
              <dd className="font-semibold text-ink">
                el equivalente a{" "}
                {status.offramp.min_payout_cop.toLocaleString("es-CO")} COP
              </dd>
              <dt className="text-muted">Comisión</dt>
              <dd className="font-semibold text-ink">
                {status.offramp.developer_fee_percent}% más la tasa de cambio
                del momento
              </dd>
            </dl>

            <p className="mt-5 max-w-prose text-sm leading-relaxed text-muted">
              La dirección es siempre la misma: guárdala y úsala cuando
              quieras. También te la enviamos a{" "}
              <strong className="text-ink">{status.email}</strong>. Haz primero
              un envío pequeño para confirmar que llega.
            </p>
          </>
        ) : null}

        {state === "destination_verified" && !status.offramp ? (
          <>
            {heading("Estamos activando tu off-ramp")}
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted" role="status">
              Tu llave Bre-B quedó registrada. Estamos creando tu dirección de
              liquidación; esta página se actualiza sola en cuanto esté lista.
              Si cierras, vuelve con tu correo y la verás aquí.
            </p>
            {status.destination ? (
              <p className="mt-4 text-sm text-muted">
                Llave Bre-B registrada:{" "}
                <strong className="text-ink">
                  {status.destination.key_masked}
                  {status.destination.bank
                    ? ` (${status.destination.bank})`
                    : ""}
                </strong>
              </p>
            ) : null}
          </>
        ) : null}

        {state === "rejected" || state === "restricted" ? (
          <>
            {heading(
              state === "rejected"
                ? "No pudimos verificar tu identidad"
                : "Tu cuenta está restringida",
            )}
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              {state === "rejected"
                ? "Bridge no aprobó la verificación."
                : "Por ahora no puedes usar el off-ramp."}{" "}
              Escríbenos a{" "}
              <a
                className="font-semibold text-brand underline"
                href={`mailto:${privacyContact}`}
              >
                {privacyContact}
              </a>{" "}
              para revisar tu caso.
            </p>
          </>
        ) : null}
      </div>

      {notice ? (
        <p className="mt-5 text-sm text-muted" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-5 rounded-xl border border-co-red/25 bg-[#fdf1f2] px-4 py-3 text-sm font-semibold text-co-red"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {status.email ? (
        <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-5 text-xs text-muted">
          <span className="break-all">Correo: {status.email}</span>
          <button
            type="button"
            onClick={signOut}
            disabled={busy}
            className="font-semibold text-brand hover:underline"
          >
            Salir
          </button>
        </p>
      ) : null}
    </div>
  );
}
