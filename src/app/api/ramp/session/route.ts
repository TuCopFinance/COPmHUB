import { clearedSessionCookie } from "@/lib/ramp/proxy";

/** Signs the person out of this site by dropping the party session cookie. */
export async function DELETE(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearedSessionCookie(), "Cache-Control": "no-store" },
  });
}
