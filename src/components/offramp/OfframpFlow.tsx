"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import {
  DOCUMENT_LABELS,
  DOCUMENT_TYPES,
  GENERIC_ERROR,
  SESSION_CODES,
  isOfferedDocument,
} from "@/lib/offramp/messages";
import {
  CONSENT_VERSION,
  OFFRAMP_RETURN_URL,
  kycStep,
  stageOf,
} from "@/lib/offramp/flow";
import {
  embeddedKycUrl,
  embeddedTosUrl,
  isKycFinished,
  isTosAccepted,
} from "@/lib/offramp/embed";
import { markOfframpPopupSeen } from "@/components/offramp/popupStorage";
import { RampError, ramp, signOutRamp } from "@/components/offramp/api";
import { BridgeStep, WaitPanel } from "@/components/offramp/parts";
import { DepositCard } from "@/components/offramp/DepositCard";
import { WithdrawSection } from "@/components/offramp/WithdrawSection";
import type { DocumentType, Party, Stage } from "@/components/offramp/types";
import {
  Field,
  StatusLine,
  Stepper,
  headingClass,
  inputClass,
  primaryClass,
  secondaryClass,
  stepIndex,
} from "@/components/offramp/ui";

type DocumentOption = { value: string; label: string };

const SESSION_EXPIRED = "Tu sesión venció. Confirma tu correo de nuevo.";

export function OfframpFlow({
  dataController,
  privacyContact,
  onrampEnabled,
}: {
  dataController: string;
  privacyContact: string;
  /** Buying USDC stays hidden until TuCOP confirms Bridge enabled it. */
  onrampEnabled: boolean;
}) {
  const [stage, setStage] = useState<Stage>("loading");
  const [party, setParty] = useState<Party | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0].value);
  const [documentNumber, setDocumentNumber] = useState("");
  const [documents, setDocuments] = useState<DocumentOption[]>([...DOCUMENT_TYPES]);
  const [consent, setConsent] = useState(false);
  const [offrampActive, setOfframpActive] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const stageRef = useRef<Stage>("loading");
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const signedOut = useCallback((message: string | null) => {
    setParty(null);
    setStage("signed_out");
    setCodeSent(false);
    setCode("");
    setNotice(message);
  }, []);

  // Reads where the person is. 401: no session. 403 party_required: signed
  // in but not registered with TuCOP Ramp yet.
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const { data } = await ramp<{ party: Party }>("GET", "v1/parties/me");
      setParty(data.party);
      setStage(stageOf(data.party));
    } catch (cause) {
      // party_not_linked: the person withdrew consent to this app. Giving it
      // again in "Tus datos" links the party back (POST /v1/parties, 200).
      if (
        cause instanceof RampError &&
        (cause.code === "party_required" || cause.code === "party_not_linked")
      ) {
        setStage("new");
        return;
      }
      if (cause instanceof RampError && cause.code && SESSION_CODES.has(cause.code)) {
        const current = stageRef.current;
        if (current !== "loading" && current !== "signed_out") setNotice(SESSION_EXPIRED);
        setStage("signed_out");
        return;
      }
      throw cause;
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Deferred so the first paint matches the server render.
    queueMicrotask(() => {
      refresh().catch(() => active && setStage("signed_out"));
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  // While Bridge reviews the identity, poll so the page moves on by itself.
  const waiting = stage === "kyc";
  useEffect(() => {
    if (!waiting) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      refresh().catch(() => {});
    };
    const timer = window.setInterval(tick, 5000);
    // Bridge may open in another tab. Coming back should show the result now.
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [waiting, refresh]);

  // Documents TuCOPRamp accepts for Colombia, with Spanish names.
  useEffect(() => {
    if (stage !== "new") return;
    let active = true;
    ramp<{ document_types: DocumentType[] }>(
      "GET",
      "v1/document-types?country=COL&party_type=individual",
    ).then(
      ({ data }) => {
        const offered = data.document_types.filter((d) => isOfferedDocument(d.code));
        if (!active || offered.length === 0) return;
        setDocuments(
          offered.map((d) => ({
            value: d.code,
            label: DOCUMENT_LABELS[d.code] ?? d.name,
          })),
        );
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [stage]);

  // Set once the person opens a Bridge page in another tab, so the KYC step
  // can say it is waiting for Bridge instead of looking stuck.
  const [openedBridge, setOpenedBridge] = useState(false);
  const [checking, setChecking] = useState(false);
  const checkNow = () => {
    setChecking(true);
    refresh()
      .catch(() => {})
      .finally(() => setChecking(false));
  };

  // Bridge's pages are framed in the KYC step and report back with
  // postMessage. The flags move the step on at once; TuCOPRamp, reading
  // Bridge, still decides the real status on the next poll.
  const [termsAcceptedHere, setTermsAcceptedHere] = useState(false);
  const [identitySentHere, setIdentitySentHere] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const onMessage = (event: MessageEvent) => {
      if (isTosAccepted(event)) {
        setTermsAcceptedHere(true);
        track("offramp_terms_accepted", { section: "offramp" });
      } else if (isKycFinished(event)) {
        setIdentitySentHere(true);
        track("offramp_identity_submitted", { section: "offramp" });
      } else {
        return;
      }
      refresh().catch(() => {});
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [waiting, refresh]);

  // Once identity is approved, a "sent" flag from that step no longer applies:
  // what is left, if anything, is the Colombia enablement.
  const kycNow = party?.status.kyc;
  useEffect(() => {
    if (kycNow === "approved") queueMicrotask(() => setIdentitySentHere(false));
  }, [kycNow]);

  // Bridge usually enables Colombia within a minute. Past five minutes the
  // page says so and offers support.
  const enabling =
    stage === "kyc" &&
    party !== null &&
    kycStep(party, { termsAccepted: termsAcceptedHere, identitySent: identitySentHere }) ===
      "enabling";
  const [enablingLong, setEnablingLong] = useState(false);
  useEffect(() => {
    if (!enabling) {
      queueMicrotask(() => setEnablingLong(false));
      return;
    }
    const timer = window.setTimeout(() => setEnablingLong(true), 5 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [enabling]);

  // Bridge sends the person back to this page in the tab it opened. The
  // session cookie is shared, so that tab can carry on too.
  const [returnedFromBridge, setReturnedFromBridge] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (["inquiry-id", "inquiry_id", "signed_agreement_id"].some((key) => params.has(key))) {
      queueMicrotask(() => setReturnedFromBridge(true));
    }
  }, []);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await action();
      } catch (cause) {
        if (cause instanceof RampError && cause.code && SESSION_CODES.has(cause.code)) {
          signedOut(SESSION_EXPIRED);
          return;
        }
        setError(cause instanceof RampError ? cause.message : GENERIC_ERROR);
      } finally {
        setBusy(false);
      }
    },
    [signedOut],
  );

  const focusHeading = () => queueMicrotask(() => headingRef.current?.focus());

  const sendCode = () =>
    run(async () => {
      await ramp("POST", "v1/sessions/email-otp", { email: email.trim() });
      setCodeSent(true);
      setNotice("Te enviamos un código de 6 dígitos. Revisa también el spam.");
    });

  const verify = () =>
    run(async () => {
      await ramp("POST", "v1/sessions/email-otp/verify", { email: email.trim(), code });
      markOfframpPopupSeen();
      setCodeSent(false);
      setCode("");
      track("offramp_email_verified", { section: "offramp" });
      await refresh();
      focusHeading();
    });

  const register = () =>
    run(async () => {
      const { data } = await ramp<{ party: Party }>("POST", "v1/parties", {
        type: "individual",
        country: "COL",
        legal_name: fullName.trim(),
        document_type: documentType,
        document_number: documentNumber.trim(),
        consent: { version: CONSENT_VERSION, accepted_at: new Date().toISOString() },
        redirect_url: OFFRAMP_RETURN_URL,
      });
      setDocumentNumber("");
      track("offramp_kyc_started", { section: "offramp" });
      setParty(data.party);
      setStage(stageOf(data.party));
      focusHeading();
    });

  const signOut = () => {
    void signOutRamp();
    setEmail("");
    setFullName("");
    setDocumentNumber("");
    setConsent(false);
    setError(null);
    setOfframpActive(false);
    signedOut(null);
  };

  const onSessionExpired = useCallback(() => signedOut(SESSION_EXPIRED), [signedOut]);

  if (stage === "loading") {
    return (
      <div className="rounded-[20px] border border-line bg-white p-6 sm:p-8">
        <p className="text-sm text-muted" role="status">
          Cargando...
        </p>
      </div>
    );
  }

  const heading = (text: string) => (
    <h2 ref={headingRef} tabIndex={-1} className={headingClass}>
      {text}
    </h2>
  );

  const identityDone = party?.status.kyc === "approved";
  const termsDone = party?.status.tos === "accepted" || termsAcceptedHere;
  const identityReviewing = party?.status.kyc === "under_review";
  const step = party
    ? kycStep(party, { termsAccepted: termsAcceptedHere, identitySent: identitySentHere })
    : null;

  return (
    <>
      <div className="rounded-[20px] border border-line bg-white p-6 sm:p-8">
        <Stepper current={stepIndex(stage, offrampActive)} />

        <div className="mt-8" aria-live="polite">
          {stage === "signed_out" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (codeSent) verify();
                else sendCode();
              }}
            >
              {heading("Empieza con tu correo")}
              {returnedFromBridge ? (
                <div
                  className="mt-4 max-w-prose rounded-2xl border border-[#137211]/30 bg-[#eef8ee] p-4 text-sm leading-relaxed text-ink"
                  role="status"
                >
                  <strong>Recibimos tu paso en Bridge.</strong> Vuelve a la pestaña donde
                  empezaste: allí el formulario avanza solo en unos segundos. Si ya la
                  cerraste, escribe tu correo aquí y continúas donde ibas.
                </div>
              ) : null}
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
                Te enviamos un código para confirmar que es tuyo. Si ya te registraste,
                con el mismo correo retomas donde lo dejaste.
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
                      setCodeSent(false);
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

          {stage === "new" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                register();
              }}
            >
              {heading("Tus datos")}
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
                Usa tu nombre y tu documento tal como aparecen en tu identificación. La
                cuenta Bre-B que registres después debe estar a ese mismo nombre y
                documento.
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
                      {documents.map((type) => (
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
                    Autorizo a {dataController} a tratar mis datos personales para
                    verificar mi identidad y prestarme{" "}
                    {onrampEnabled
                      ? "los servicios de retiro y depósito"
                      : "el servicio de retiro"}{" "}
                    en pesos, y a compartirlos con Bridge, su proveedor de verificación y
                    pagos, según el{" "}
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

          {stage === "kyc" && party ? (
            <>
              {heading("Verifica tu identidad")}
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
                Son dos pasos con Bridge, nuestro proveedor, y los haces aquí mismo. Ten a
                la mano tu documento. Puedes cerrar esta página y volver después con tu
                correo: tu avance queda guardado.
              </p>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                <StatusLine label="Términos" done={termsDone} />
                <StatusLine
                  label="Identidad"
                  done={identityDone}
                  reviewing={identityReviewing || identitySentHere}
                />
              </div>

              {step === "terms" && party.links.tos ? (
                <BridgeStep
                  title="1. Acepta los términos de Bridge"
                  body="La página de Bridge está en inglés. Al pulsar “Accept” aceptas sus Términos de Servicio y su Política de Privacidad."
                  frameTitle="Términos de Bridge"
                  src={embeddedTosUrl(party.links.tos)}
                  link={party.links.tos}
                  linkLabel="Aceptar términos"
                  help="¿No carga?"
                  height={480}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                  onOpenTab={() => setOpenedBridge(true)}
                />
              ) : null}

              {(step === "identity" || step === "cop") && party.links.kyc ? (
                <BridgeStep
                  title={
                    step === "cop"
                      ? "3. Completa tu habilitación para Colombia"
                      : "2. Verifica tu identidad"
                  }
                  body={
                    step === "cop"
                      ? "Tu identidad ya está aprobada. Bridge necesita unos datos más para habilitar tu cuenta en Colombia: complétalos aquí y la página avanza sola."
                      : "Bridge te pide una foto de tu documento y una selfie. Cuando el navegador pregunte, permite el uso de la cámara."
                  }
                  frameTitle={
                    step === "cop"
                      ? "Habilitación para Colombia en Bridge"
                      : "Verificación de identidad de Bridge"
                  }
                  src={embeddedKycUrl(party.links.kyc, window.location.origin)}
                  link={party.links.kyc}
                  linkLabel={step === "cop" ? "Completar habilitación" : "Verificar identidad"}
                  help="¿No carga o no te deja usar la cámara?"
                  height={680}
                  allow="camera"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
                  onOpenTab={() => setOpenedBridge(true)}
                />
              ) : null}

              {step === "enabling" ? (
                <WaitPanel
                  title="Ya casi: estamos habilitando tu cuenta"
                  body={
                    enablingLong
                      ? "Bridge está tardando más de lo normal en activar tu cuenta para Colombia. Puedes dejar esta página abierta, avanza sola, o volver más tarde con tu correo."
                      : "Tu identidad y los términos están listos. Bridge está terminando de activar tu cuenta para Colombia; suele tardar menos de un minuto. No cierres esta página: avanza sola."
                  }
                />
              ) : step === "reviewing" || step === "cop_review" ? (
                <WaitPanel
                  title={
                    step === "cop_review"
                      ? "Bridge está revisando tus datos para Colombia"
                      : "Bridge está revisando tu identidad"
                  }
                  body="Puede tardar unos minutos. Puedes dejar esta página abierta, avanza sola, o cerrarla y volver más tarde con tu correo."
                />
              ) : openedBridge && (step === "terms" || step === "identity" || step === "cop") ? (
                <WaitPanel
                  title="Esperando tu verificación en Bridge"
                  body="Completa los pasos en la pestaña de Bridge que se abrió. Cuando termines, vuelve aquí: esta página se actualiza sola en unos segundos. La pestaña de Bridge la puedes cerrar."
                />
              ) : null}

              {step === "stuck" || (step === "enabling" && enablingLong) ? (
                <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted" role="status">
                  {step === "stuck"
                    ? "A tu verificación le falta un paso que no podemos abrir desde aquí. "
                    : "Si sigue así, "}
                  escríbenos a{" "}
                  <a
                    className="font-semibold text-brand underline"
                    href={`mailto:${privacyContact}`}
                  >
                    {privacyContact}
                  </a>{" "}
                  con el correo que usaste y lo revisamos.
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                {openedBridge || step !== "terms" ? (
                  <button
                    type="button"
                    onClick={checkNow}
                    disabled={checking}
                    className={secondaryClass}
                  >
                    {checking
                      ? "Revisando..."
                      : step === "enabling" || step === "stuck"
                        ? "Revisar de nuevo"
                        : "Ya terminé, revisar ahora"}
                  </button>
                ) : null}
                {identitySentHere && (step === "reviewing" || step === "cop_review") &&
                !identityReviewing ? (
                  <button
                    type="button"
                    onClick={() => setIdentitySentHere(false)}
                    className={secondaryClass}
                  >
                    Abrir la verificación otra vez
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {stage === "verified" ? (
            <WithdrawSection
              onSessionExpired={onSessionExpired}
              onActiveChange={setOfframpActive}
            />
          ) : null}

          {stage === "rejected" || stage === "restricted" ? (
            <>
              {heading(
                stage === "rejected"
                  ? "No pudimos verificar tu identidad"
                  : "Tu cuenta está restringida",
              )}
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
                {stage === "rejected"
                  ? "Bridge no aprobó la verificación."
                  : "Por ahora no puedes usar estos servicios."}{" "}
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

        {stage !== "signed_out" ? (
          <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-5 text-xs text-muted">
            {email ? <span className="break-all">Correo: {email.trim()}</span> : null}
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

      {stage === "verified" && onrampEnabled ? (
        <DepositCard onSessionExpired={onSessionExpired} />
      ) : null}
    </>
  );
}
