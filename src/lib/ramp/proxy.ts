import { isIP } from "node:net";
import { forwardedQuery, matchRampRoute } from "./routes";
import type { RampServerConfig } from "@/lib/offramp/config";

/**
 * Relays an allowed call from the browser to TuCOPRamp.
 *
 * Request and response bodies carry the person's name and document number:
 * they pass through untouched and are never logged or stored. The party
 * session token never reaches client code: it lives in an httpOnly cookie.
 */

export const RAMP_API_VERSION = "2026-10-08";
export const SESSION_COOKIE = "ramp_party_session";
export const SESSION_COOKIE_PATH = "/api/ramp";
const SESSION_MAX_AGE = 60 * 60;
const MAX_BODY_BYTES = 16 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;

export type ProxyRequest = {
  method: string;
  segments: readonly string[];
  search: URLSearchParams;
  body: string | null;
  sessionToken: string | null;
  /** Value of the Origin header, if any. */
  origin: string | null;
  /** Host the browser called, to compare with Origin. */
  host: string | null;
  /** Value of Sec-Fetch-Site, if any. */
  fetchSite: string | null;
  /**
   * Address the person connected from, as the hosting edge saw it. Never a
   * value the browser can set (such as its own X-Forwarded-For).
   */
  clientIp: string | null;
  /**
   * Idempotency-Key the page chose for this action. The page sends the same
   * key when it retries the same action, so the ramp does it once.
   */
  idempotencyKey: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProxyResponse = {
  status: number;
  body: string;
  contentType: string;
  /** Set-Cookie values to send, if any. */
  cookies: string[];
  retryAfter: string | null;
};

export type ProxyDeps = {
  config: RampServerConfig;
  fetch: typeof fetch;
  randomUUID: () => string;
  now: () => number;
};

function problem(status: number, code: string, detail: string): ProxyResponse {
  return {
    status,
    body: JSON.stringify({ status, code, detail }),
    contentType: "application/problem+json",
    cookies: [],
    retryAfter: null,
  };
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    `Path=${SESSION_COOKIE_PATH}`,
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function clearedSessionCookie(): string {
  return sessionCookie("", 0);
}

/** A cross-site page must not be able to act with the person's cookie. */
function sameOrigin(req: ProxyRequest): boolean {
  if (req.fetchSite && req.fetchSite !== "same-origin" && req.fetchSite !== "none") {
    return false;
  }
  if (!req.origin) return true;
  try {
    return new URL(req.origin).host === req.host;
  } catch {
    return false;
  }
}

/**
 * One IPv4 or IPv6 address, or null. TuCOPRamp keys its per-person limits on
 * it, so anything that is not exactly one address is dropped, not guessed at.
 */
export function clientAddress(value: string | null): string | null {
  const ip = value?.trim();
  if (!ip || isIP(ip) === 0) return null;
  // An IPv4 client seen over an IPv6 socket: send the IPv4 form.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  return mapped ? mapped[1] : ip;
}

function readJsonObject(body: string | null): string | null {
  if (body === null || body.trim() === "") return "{}";
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

export async function proxyRampRequest(
  req: ProxyRequest,
  deps: ProxyDeps,
): Promise<ProxyResponse> {
  const route = matchRampRoute(req.method, req.segments);
  if (!route) return problem(404, "not_found", "The requested resource was not found.");

  if (route.method === "POST" && !sameOrigin(req)) {
    return problem(403, "forbidden_origin", "Requests must come from this site.");
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-TuCOPRamp-Key": deps.config.apiKey,
    "TuCOPRamp-Version": RAMP_API_VERSION,
  };
  // Every call reaches TuCOPRamp from this server's address. With the
  // person's own address its per-IP limits apply per person, not to the
  // whole site. TuCOPRamp only trusts it with this integrator key.
  const clientIp = clientAddress(req.clientIp);
  if (clientIp) headers["X-TuCOPRamp-Client-IP"] = clientIp;

  let body: string | undefined;
  if (route.method === "POST") {
    if (req.body !== null && new TextEncoder().encode(req.body).length > MAX_BODY_BYTES) {
      return problem(413, "payload_too_large", "The body is too large.");
    }
    const json = readJsonObject(req.body);
    if (json === null) return problem(400, "invalid_json", "The body must be a JSON object.");
    body = json;
    headers["Content-Type"] = "application/json";
    if (route.idempotent) {
      const key = req.idempotencyKey?.trim();
      headers["Idempotency-Key"] = key && UUID.test(key) ? key.toLowerCase() : deps.randomUUID();
    }
  }

  if (route.session === "use") {
    if (!req.sessionToken) {
      return problem(401, "party_session_required", "Sign in with your email first.");
    }
    headers["X-TuCOPRamp-Party-Session"] = req.sessionToken;
  }

  const url = `${deps.config.apiUrl}/${req.segments.join("/")}${forwardedQuery(route, req.search)}`;

  let upstream: Response;
  try {
    upstream = await deps.fetch(url, {
      method: route.method,
      headers,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    // The path is the only thing worth knowing here; never the body.
    console.error("[api:ramp] upstream unreachable", { path: route.pattern.source });
    return problem(502, "ramp_unreachable", "The ramp could not be reached.");
  }

  const text = await upstream.text();
  const response: ProxyResponse = {
    status: upstream.status,
    body: text,
    contentType: upstream.headers.get("content-type") ?? "application/json",
    cookies: [],
    retryAfter: upstream.headers.get("retry-after"),
  };

  if (route.session === "issue" && upstream.ok) {
    return withIssuedSession(response, text, deps.now());
  }

  if (upstream.status === 401) {
    const code = errorCode(text);
    if (code === "party_session_invalid" || code === "party_session_required") {
      response.cookies.push(clearedSessionCookie());
    }
  }
  return response;
}

/** Moves the session token from the body into the cookie. */
function withIssuedSession(response: ProxyResponse, text: string, now: number): ProxyResponse {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return problem(502, "ramp_invalid_response", "The ramp answered something unexpected.");
  }
  const token = parsed.token;
  if (typeof token !== "string" || !/^[A-Za-z0-9._~-]+$/.test(token)) {
    return problem(502, "ramp_invalid_response", "The ramp answered something unexpected.");
  }
  const expiresAt = typeof parsed.expires_at === "string" ? Date.parse(parsed.expires_at) : NaN;
  const maxAge = Number.isFinite(expiresAt)
    ? Math.min(SESSION_MAX_AGE, (expiresAt - now) / 1000)
    : SESSION_MAX_AGE;
  const { token: _dropped, ...rest } = parsed;
  void _dropped;
  return {
    ...response,
    body: JSON.stringify(rest),
    contentType: "application/json",
    cookies: [sessionCookie(token, maxAge)],
  };
}

function errorCode(text: string): string | null {
  try {
    const code = (JSON.parse(text) as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  } catch {
    return null;
  }
}
