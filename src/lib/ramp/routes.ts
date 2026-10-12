/**
 * The TuCOPRamp calls the browser may make through /api/ramp. Anything not
 * listed here is refused before it reaches the ramp.
 */

export type RampMethod = "GET" | "POST";

/**
 * - `none`: no party session is sent (sign-in, static data).
 * - `issue`: the call returns a party session; the proxy keeps it in a cookie.
 * - `use`: the call acts for the signed-in person.
 */
export type SessionMode = "none" | "issue" | "use";

export type RampRoute = {
  method: RampMethod;
  pattern: RegExp;
  session: SessionMode;
  /** POSTs that need an Idempotency-Key. The session calls must not get one. */
  idempotent: boolean;
  /** Query parameters forwarded as they are. Others are dropped. */
  query?: readonly string[];
};

// Public ids are a prefix plus 26 Crockford base32 characters.
const DST = "dst_[0-9a-hjkmnp-tv-z]{26}";
const WDR = "wdr_[0-9a-hjkmnp-tv-z]{26}";

export const RAMP_ROUTES: readonly RampRoute[] = [
  { method: "POST", pattern: /^v1\/sessions\/email-otp$/, session: "none", idempotent: false },
  { method: "POST", pattern: /^v1\/sessions\/email-otp\/verify$/, session: "issue", idempotent: false },
  {
    method: "GET",
    pattern: /^v1\/document-types$/,
    session: "none",
    idempotent: false,
    query: ["country", "party_type"],
  },
  { method: "GET", pattern: /^v1\/parties\/me$/, session: "use", idempotent: false },
  { method: "POST", pattern: /^v1\/parties$/, session: "use", idempotent: true },
  { method: "GET", pattern: /^v1\/destinations$/, session: "use", idempotent: false },
  { method: "POST", pattern: /^v1\/destinations$/, session: "use", idempotent: true },
  { method: "GET", pattern: new RegExp(`^v1/destinations/${DST}$`, "i"), session: "use", idempotent: false },
  {
    method: "POST",
    pattern: new RegExp(`^v1/destinations/${DST}/confirm$`, "i"),
    session: "use",
    idempotent: true,
  },
  { method: "GET", pattern: /^v1\/withdrawals$/, session: "use", idempotent: false },
  { method: "POST", pattern: /^v1\/withdrawals$/, session: "use", idempotent: true },
  // The address with its payouts.
  { method: "GET", pattern: new RegExp(`^v1/withdrawals/${WDR}$`, "i"), session: "use", idempotent: false },
  // How much USDC to send so a given amount of pesos arrives. Only a price.
  { method: "POST", pattern: /^v1\/quotes$/, session: "use", idempotent: true },
  { method: "GET", pattern: /^v1\/deposits$/, session: "use", idempotent: false },
  { method: "POST", pattern: /^v1\/deposits$/, session: "use", idempotent: true },
];

/** The route for a request, or null when it is not allowed. */
export function matchRampRoute(method: string, segments: readonly string[]): RampRoute | null {
  // Each segment comes decoded from the router. A slash, a dot segment or an
  // encoded character inside one would let a caller reach another path.
  if (segments.length === 0 || segments.some((s) => !/^[A-Za-z0-9_-]+$/.test(s))) {
    return null;
  }
  const path = segments.join("/");
  return RAMP_ROUTES.find((r) => r.method === method && r.pattern.test(path)) ?? null;
}

/** The query string to forward: only the parameters the route lists. */
export function forwardedQuery(route: RampRoute, search: URLSearchParams): string {
  if (!route.query) return "";
  const out = new URLSearchParams();
  for (const name of route.query) {
    const value = search.get(name);
    if (value !== null && value.length <= 40) out.set(name, value);
  }
  const text = out.toString();
  return text ? `?${text}` : "";
}
