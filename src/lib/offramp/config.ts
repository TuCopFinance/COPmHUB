/**
 * Bre-B off-ramp pre-registration.
 *
 * This site only hosts the form. Every record lives in TuCOPRamp, the TuCOP
 * service the browser talks to directly; nothing is stored or proxied here,
 * and this repo holds no keys.
 */

export const OFFRAMP_PATH = "/offramp";

export type OfframpConfig = {
  /** Base URL of the TuCOPRamp API, without a trailing slash. */
  apiUrl: string;
  /** Legal name of the data controller, shown in the consent text. */
  dataController: string;
  /** Contact email for privacy requests and support. */
  privacyContact: string;
};

type Source = Record<string, string | undefined>;

const REQUIRED = [
  "OFFRAMP_API_URL",
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

/** Names of required variables that are missing or malformed. */
export function missingOfframpEnv(source: Source = process.env): string[] {
  const missing: string[] = REQUIRED.filter((name) => !source[name]?.trim());
  const api = source.OFFRAMP_API_URL?.trim();
  if (api && !isHttpsUrl(api)) missing.push("OFFRAMP_API_URL (must be https)");
  return missing;
}

/**
 * On only when the flag is set AND the consent text can name who is
 * responsible for the data. A half-configured deploy shows nothing.
 */
export function isOfframpEnabled(source: Source = process.env): boolean {
  return (
    source.OFFRAMP_ENABLED === "true" && missingOfframpEnv(source).length === 0
  );
}

export function offrampConfig(source: Source = process.env): OfframpConfig {
  const missing = missingOfframpEnv(source);
  if (missing.length > 0) {
    throw new Error(`Off-ramp is not configured: missing ${missing.join(", ")}`);
  }
  return {
    apiUrl: source.OFFRAMP_API_URL!.trim().replace(/\/+$/, ""),
    dataController: source.OFFRAMP_DATA_CONTROLLER!.trim(),
    privacyContact: source.OFFRAMP_PRIVACY_CONTACT!.trim(),
  };
}
