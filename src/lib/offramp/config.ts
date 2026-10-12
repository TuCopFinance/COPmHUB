/**
 * Bre-B off-ramp and on-ramp registration.
 *
 * The people who register here are direct clients of TuCOP Ramp. The form
 * talks to this site's own server (/api/ramp), which relays a fixed list of
 * calls to the TuCOPRamp platform API with TuCOP Ramp's integrator key. The
 * key never reaches the browser, and nothing the person types is stored or
 * logged here.
 */

export const OFFRAMP_PATH = "/offramp";

export type OfframpConfig = {
  /** Legal name of the data controller, shown in the consent text. */
  dataController: string;
  /** Contact email for privacy requests and support. */
  privacyContact: string;
};

export type RampServerConfig = {
  /** Base URL of the TuCOPRamp API, without a trailing slash. */
  apiUrl: string;
  /** TuCOP Ramp's integrator key. Server only. */
  apiKey: string;
};

type Source = Record<string, string | undefined>;

const REQUIRED = [
  "TUCOPRAMP_API_URL",
  "TUCOPRAMP_API_KEY",
  "OFFRAMP_DATA_CONTROLLER",
  "OFFRAMP_PRIVACY_CONTACT",
] as const;

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    // Plain http is for local development only.
    return url.protocol === "http:" && url.hostname === "localhost";
  } catch {
    return false;
  }
}

/** Names of required variables that are missing or malformed. Never values. */
export function missingOfframpEnv(source: Source = process.env): string[] {
  const missing: string[] = REQUIRED.filter((name) => !source[name]?.trim());
  const api = source.TUCOPRAMP_API_URL?.trim();
  if (api && !isHttpsUrl(api)) missing.push("TUCOPRAMP_API_URL (must be https)");
  return missing;
}

/**
 * On only when the flag is set, the server can reach the ramp, and the
 * consent text can name who is responsible for the data. A half-configured
 * deploy shows nothing.
 */
export function isOfframpEnabled(source: Source = process.env): boolean {
  return (
    source.OFFRAMP_ENABLED === "true" && missingOfframpEnv(source).length === 0
  );
}

/** What pages may show. Holds nothing secret. */
export function offrampConfig(source: Source = process.env): OfframpConfig {
  assertConfigured(source);
  return {
    dataController: source.OFFRAMP_DATA_CONTROLLER!.trim(),
    privacyContact: source.OFFRAMP_PRIVACY_CONTACT!.trim(),
  };
}

/** For the /api/ramp route only: holds the integrator key. */
export function rampServerConfig(source: Source = process.env): RampServerConfig {
  assertConfigured(source);
  return {
    apiUrl: source.TUCOPRAMP_API_URL!.trim().replace(/\/+$/, ""),
    apiKey: source.TUCOPRAMP_API_KEY!.trim(),
  };
}

function assertConfigured(source: Source): void {
  const missing = missingOfframpEnv(source);
  if (missing.length > 0) {
    throw new Error(`Off-ramp is not configured: missing ${missing.join(", ")}`);
  }
}
