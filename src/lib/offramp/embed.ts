/**
 * Bridge's two onboarding pages, shown inside the form instead of in new tabs.
 *
 * Both links come from TuCOPRamp as Bridge issued them. They are only framed
 * when they point at the hosts below, which are the same ones allowed in
 * `frame-src` (next.config.ts). A link on any other host falls back to
 * opening in a new tab, so a change on Bridge's side degrades instead of
 * breaking the step.
 */

/** Host Bridge serves its terms acceptance page from. */
export const BRIDGE_TOS_ORIGIN = "https://compliance.bridge.xyz";
/** Host of Bridge's identity verification, run by Persona. */
export const BRIDGE_KYC_ORIGIN = "https://bridge.withpersona.com";

export const BRIDGE_FRAME_ORIGINS = [BRIDGE_TOS_ORIGIN, BRIDGE_KYC_ORIGIN] as const;

function parse(link: string | null | undefined, origin: string): URL | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    return url.origin === origin ? url : null;
  } catch {
    return null;
  }
}

/**
 * Terms page for an iframe. Without `redirect_uri` the page reports the
 * acceptance to its parent with `postMessage` instead of navigating to this
 * site inside the frame, which `frame-ancestors 'none'` would block.
 */
export function embeddedTosUrl(link: string | null | undefined): string | null {
  const url = parse(link, BRIDGE_TOS_ORIGIN);
  if (!url) return null;
  url.searchParams.delete("redirect_uri");
  return url.toString();
}

/**
 * Identity verification for an iframe, as Bridge documents it: `/verify`
 * becomes `/widget` and `iframe-origin` names the page that hosts it.
 */
export function embeddedKycUrl(
  link: string | null | undefined,
  pageOrigin: string,
): string | null {
  const url = parse(link, BRIDGE_KYC_ORIGIN);
  if (!url || url.pathname !== "/verify") return null;
  url.pathname = "/widget";
  url.searchParams.delete("redirect-uri");
  url.searchParams.set("iframe-origin", pageOrigin);
  // Persona picks English unless told otherwise; the person can still switch.
  if (!url.searchParams.has("language")) url.searchParams.set("language", "es");
  return url.toString();
}

type MessageLike = { origin: string; data: unknown };

/** True when Bridge's terms page says the person accepted. */
export function isTosAccepted(event: MessageLike): boolean {
  if (event.origin !== BRIDGE_TOS_ORIGIN) return false;
  const data = event.data as { signedAgreementId?: unknown } | null;
  return typeof data?.signedAgreementId === "string" && data.signedAgreementId !== "";
}

/**
 * True when the identity widget says the person reached the end. Only a hint
 * to re-read the status now: TuCOPRamp, reading Bridge, decides the outcome.
 */
export function isKycFinished(event: MessageLike): boolean {
  if (event.origin !== BRIDGE_KYC_ORIGIN) return false;
  const data = event.data as { name?: unknown } | null;
  return data?.name === "complete";
}
