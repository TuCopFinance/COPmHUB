import type { NextRequest } from "next/server";
import { isOfframpEnabled, rampServerConfig } from "@/lib/offramp/config";
import { SESSION_COOKIE, clearedSessionCookie, signOutRampSession } from "@/lib/ramp/proxy";

/**
 * Signs the person out: revokes the party session at TuCOPRamp, then drops
 * the cookie.
 */
export async function DELETE(request: NextRequest): Promise<Response> {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (!isOfframpEnabled()) {
    headers.append("Set-Cookie", clearedSessionCookie());
    return new Response(null, { status: 204, headers });
  }
  const result = await signOutRampSession(
    {
      sessionToken: request.cookies.get(SESSION_COOKIE)?.value ?? null,
      origin: request.headers.get("origin"),
      host: request.headers.get("host"),
      fetchSite: request.headers.get("sec-fetch-site"),
      // Set and overwritten by Railway's edge; see [...path]/route.ts.
      clientIp: request.headers.get("x-real-ip"),
    },
    { config: rampServerConfig(), fetch },
  );
  for (const cookie of result.cookies) headers.append("Set-Cookie", cookie);
  if (result.status === 204) return new Response(null, { status: 204, headers });
  headers.set("Content-Type", result.contentType);
  return new Response(result.body, { status: result.status, headers });
}
