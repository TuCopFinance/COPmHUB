import { describe, expect, it, vi } from "vitest";
import { forwardedQuery, matchRampRoute } from "./routes";
import {
  RAMP_API_VERSION,
  SESSION_COOKIE,
  clientAddress,
  proxyRampRequest,
  type ProxyRequest,
} from "./proxy";

const KEY = "tcr_live_sk_example.secret";
const DST = "dst_01j9z3k8q2m4n6p8r0s2t4v6w8";

function request(over: Partial<ProxyRequest> = {}): ProxyRequest {
  return {
    method: "GET",
    segments: ["v1", "parties", "me"],
    search: new URLSearchParams(),
    body: null,
    sessionToken: "tps_session",
    origin: "https://digitalcop.shop",
    host: "digitalcop.shop",
    fetchSite: "same-origin",
    clientIp: "181.49.12.34",
    ...over,
  };
}

function upstream(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    }),
  );
}

function deps(fetchImpl: ReturnType<typeof upstream>) {
  return {
    config: { apiUrl: "https://api.ramp.tucop.xyz", apiKey: KEY },
    fetch: fetchImpl as unknown as typeof fetch,
    randomUUID: () => "6f1c1a2e-1111-4222-8333-444455556666",
    now: () => Date.parse("2026-10-11T12:00:00Z"),
  };
}

function sent(fetchImpl: ReturnType<typeof upstream>) {
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

describe("ramp allowlist", () => {
  it("allows only the calls the form makes", () => {
    expect(matchRampRoute("POST", ["v1", "sessions", "email-otp"])).not.toBeNull();
    expect(matchRampRoute("POST", ["v1", "sessions", "email-otp", "verify"])).not.toBeNull();
    expect(matchRampRoute("GET", ["v1", "parties", "me"])).not.toBeNull();
    expect(matchRampRoute("POST", ["v1", "parties"])).not.toBeNull();
    expect(matchRampRoute("GET", ["v1", "destinations", DST])).not.toBeNull();
    expect(matchRampRoute("POST", ["v1", "destinations", DST, "confirm"])).not.toBeNull();
    expect(matchRampRoute("POST", ["v1", "withdrawals"])).not.toBeNull();
    expect(matchRampRoute("POST", ["v1", "deposits"])).not.toBeNull();
  });

  it("refuses everything else", () => {
    expect(matchRampRoute("GET", ["v1", "consumer"])).toBeNull();
    expect(matchRampRoute("POST", ["v1", "payments"])).toBeNull();
    expect(matchRampRoute("GET", ["v1", "prereg", "me"])).toBeNull();
    expect(matchRampRoute("DELETE", ["v1", "destinations", DST])).toBeNull();
    expect(matchRampRoute("GET", ["v1", "parties"])).toBeNull();
    expect(matchRampRoute("POST", ["v1", "parties", "me"])).toBeNull();
    expect(matchRampRoute("GET", ["v1", "destinations", "dst_bad"])).toBeNull();
    expect(matchRampRoute("GET", ["v1", "destinations", "..", "consumer"])).toBeNull();
    expect(matchRampRoute("GET", ["v1", "parties%2Fme"])).toBeNull();
    expect(matchRampRoute("GET", ["v1/parties/me"])).toBeNull();
    expect(matchRampRoute("GET", [])).toBeNull();
  });

  it("forwards only the query parameters a route lists", () => {
    const route = matchRampRoute("GET", ["v1", "document-types"])!;
    const search = new URLSearchParams("country=COL&party_type=individual&evil=1");
    expect(forwardedQuery(route, search)).toBe("?country=COL&party_type=individual");
    const me = matchRampRoute("GET", ["v1", "parties", "me"])!;
    expect(forwardedQuery(me, search)).toBe("");
  });
});

describe("ramp relay", () => {
  it("adds the integrator key, the version and the party session", async () => {
    const f = upstream(200, { party: { id: "pty_x" } });
    const res = await proxyRampRequest(request(), deps(f));
    const { url, headers, init } = sent(f);
    expect(url).toBe("https://api.ramp.tucop.xyz/v1/parties/me");
    expect(headers["X-TuCOPRamp-Key"]).toBe(KEY);
    expect(headers["TuCOPRamp-Version"]).toBe(RAMP_API_VERSION);
    expect(headers["X-TuCOPRamp-Party-Session"]).toBe("tps_session");
    expect(headers["Idempotency-Key"]).toBeUndefined();
    expect(init.method).toBe("GET");
    expect(res.status).toBe(200);
    expect(res.body).not.toContain(KEY);
  });

  it("adds an Idempotency-Key to POSTs, but not to the session calls", async () => {
    const f = upstream(201, { party: {} });
    await proxyRampRequest(
      request({ method: "POST", segments: ["v1", "parties"], body: '{"type":"individual"}' }),
      deps(f),
    );
    expect(sent(f).headers["Idempotency-Key"]).toBe("6f1c1a2e-1111-4222-8333-444455556666");

    const g = upstream(202, { expires_at: "2026-10-11T12:10:00Z" });
    await proxyRampRequest(
      request({
        method: "POST",
        segments: ["v1", "sessions", "email-otp"],
        body: '{"email":"a@b.co"}',
        sessionToken: "tps_session",
      }),
      deps(g),
    );
    expect(sent(g).headers["Idempotency-Key"]).toBeUndefined();
    expect(sent(g).headers["X-TuCOPRamp-Party-Session"]).toBeUndefined();
  });

  it("keeps the session token out of the body and in an httpOnly cookie", async () => {
    const f = upstream(201, {
      token: "tps_secret_token",
      method: "email_otp",
      expires_at: "2026-10-11T13:00:00Z",
      party_id: null,
    });
    const res = await proxyRampRequest(
      request({
        method: "POST",
        segments: ["v1", "sessions", "email-otp", "verify"],
        body: '{"email":"a@b.co","code":"123456"}',
        sessionToken: null,
      }),
      deps(f),
    );
    expect(res.status).toBe(201);
    expect(res.body).not.toContain("tps_secret_token");
    expect(JSON.parse(res.body)).toEqual({
      method: "email_otp",
      expires_at: "2026-10-11T13:00:00Z",
      party_id: null,
    });
    const [cookie] = res.cookies;
    expect(cookie).toContain(`${SESSION_COOKIE}=tps_secret_token`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=3600");
  });

  it("caps the cookie at the session's own expiry", async () => {
    const f = upstream(201, { token: "tps_t", expires_at: "2026-10-11T12:20:00Z" });
    const res = await proxyRampRequest(
      request({ method: "POST", segments: ["v1", "sessions", "email-otp", "verify"], body: "{}" }),
      deps(f),
    );
    expect(res.cookies[0]).toContain("Max-Age=1200");
  });

  it("clears the cookie when the ramp says the session is gone", async () => {
    const f = upstream(401, { status: 401, code: "party_session_invalid" });
    const res = await proxyRampRequest(request(), deps(f));
    expect(res.status).toBe(401);
    expect(res.cookies[0]).toContain("Max-Age=0");
  });

  it("returns the ramp's status, body and Retry-After unchanged", async () => {
    const body = { status: 429, code: "rate_limited_email", detail: "Too many" };
    const f = upstream(429, body, { "retry-after": "60" });
    const res = await proxyRampRequest(
      request({ method: "POST", segments: ["v1", "sessions", "email-otp"], body: "{}" }),
      deps(f),
    );
    expect(res.status).toBe(429);
    expect(JSON.parse(res.body)).toEqual(body);
    expect(res.retryAfter).toBe("60");
  });

  it("does not call the ramp for a refused path, a missing session or a cross-site POST", async () => {
    const f = upstream(200, {});
    expect((await proxyRampRequest(request({ segments: ["v1", "consumer"] }), deps(f))).status).toBe(404);
    expect((await proxyRampRequest(request({ sessionToken: null }), deps(f))).status).toBe(401);
    const crossSite = await proxyRampRequest(
      request({ method: "POST", segments: ["v1", "parties"], body: "{}", origin: "https://evil.example" }),
      deps(f),
    );
    expect(crossSite.status).toBe(403);
    const fetchSite = await proxyRampRequest(
      request({ method: "POST", segments: ["v1", "parties"], body: "{}", fetchSite: "cross-site" }),
      deps(f),
    );
    expect(fetchSite.status).toBe(403);
    expect(f).not.toHaveBeenCalled();
  });

  it("only forwards JSON objects", async () => {
    const f = upstream(200, {});
    for (const body of ["not json", "[1,2]", '"text"', "null"]) {
      const res = await proxyRampRequest(
        request({ method: "POST", segments: ["v1", "parties"], body }),
        deps(f),
      );
      expect(res.status).toBe(400);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("sends the person's address on every call, including the session ones", async () => {
    const f = upstream(200, {});
    await proxyRampRequest(request(), deps(f));
    expect(sent(f).headers["X-TuCOPRamp-Client-IP"]).toBe("181.49.12.34");

    const g = upstream(202, {});
    await proxyRampRequest(
      request({
        method: "POST",
        segments: ["v1", "sessions", "email-otp"],
        body: "{}",
        clientIp: "2800:e2:2780:1a3::5",
      }),
      deps(g),
    );
    expect(sent(g).headers["X-TuCOPRamp-Client-IP"]).toBe("2800:e2:2780:1a3::5");
  });

  it("leaves the header out rather than send something that is not one address", async () => {
    for (const clientIp of [null, "", "unknown", "181.49.12.34, 10.0.0.1", "1.2.3.4:443", "[::1]"]) {
      const f = upstream(200, {});
      await proxyRampRequest(request({ clientIp }), deps(f));
      expect(sent(f).headers["X-TuCOPRamp-Client-IP"], String(clientIp)).toBeUndefined();
    }
  });

  it("accepts exactly one IPv4 or IPv6 address", () => {
    expect(clientAddress(" 181.49.12.34 ")).toBe("181.49.12.34");
    expect(clientAddress("::ffff:181.49.12.34")).toBe("181.49.12.34");
    expect(clientAddress("2800:e2:2780:1a3::5")).toBe("2800:e2:2780:1a3::5");
    expect(clientAddress("999.1.1.1")).toBeNull();
    expect(clientAddress("181.49.12.34,181.49.12.35")).toBeNull();
  });

  it("answers 502 without the body when the ramp cannot be reached", async () => {
    const f = vi.fn(async () => {
      throw new Error("boom");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await proxyRampRequest(
      request({ method: "POST", segments: ["v1", "parties"], body: '{"document_number":"1017123456"}' }),
      deps(f as unknown as ReturnType<typeof upstream>),
    );
    expect(res.status).toBe(502);
    expect(JSON.parse(res.body).code).toBe("ramp_unreachable");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("1017123456");
    spy.mockRestore();
  });
});
