import type { NextRequest } from "next/server";
import { isOfframpEnabled, rampServerConfig } from "@/lib/offramp/config";
import { SESSION_COOKIE, proxyRampRequest, type ProxyResponse } from "@/lib/ramp/proxy";

// Relays the off-ramp form's calls to TuCOPRamp with TuCOP Ramp's integrator
// key. See src/lib/ramp/proxy.ts for what is forwarded and what is not.

type Context = { params: Promise<{ path: string[] }> };

function toResponse(result: ProxyResponse): Response {
  const headers = new Headers({
    "Content-Type": result.contentType,
    "Cache-Control": "no-store",
  });
  if (result.retryAfter) headers.set("Retry-After", result.retryAfter);
  for (const cookie of result.cookies) headers.append("Set-Cookie", cookie);
  return new Response(result.body, { status: result.status, headers });
}

async function handle(request: NextRequest, context: Context): Promise<Response> {
  if (!isOfframpEnabled()) {
    return new Response(JSON.stringify({ status: 404, code: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  const { path } = await context.params;
  const result = await proxyRampRequest(
    {
      method: request.method,
      segments: path ?? [],
      search: request.nextUrl.searchParams,
      body: request.method === "POST" ? await request.text() : null,
      sessionToken: request.cookies.get(SESSION_COOKIE)?.value ?? null,
      origin: request.headers.get("origin"),
      host: request.headers.get("host"),
      fetchSite: request.headers.get("sec-fetch-site"),
      // Railway's edge sets X-Real-IP to the connecting address and replaces
      // any copy the caller sent; the app is only reachable through it.
      // X-Forwarded-For is not used: a caller can put anything in it.
      clientIp: request.headers.get("x-real-ip"),
      idempotencyKey: request.headers.get("idempotency-key"),
    },
    {
      config: rampServerConfig(),
      fetch,
      randomUUID: () => crypto.randomUUID(),
      now: () => Date.now(),
    },
  );
  return toResponse(result);
}

export const GET = handle;
export const POST = handle;
