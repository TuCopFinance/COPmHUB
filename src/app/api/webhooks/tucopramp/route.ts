import { webhookSecret } from "@/lib/offramp/config";
import { MAX_WEBHOOK_BYTES, eventSummary, verifyWebhook } from "@/lib/ramp/webhook";

// Receives the TuCOP Ramp integrator's events. Every event of the integrator
// arrives, including clients who registered on ramp.tucop.xyz: this site has
// no database and keeps no client list, so a verified event is acknowledged
// and the form keeps reading state from the API. Unknown types get 200 too.

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const secret = webhookSecret();
  if (!secret) return reply(503, { code: "webhook_not_configured" });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_WEBHOOK_BYTES) return reply(413, { code: "payload_too_large" });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_WEBHOOK_BYTES) {
    return reply(413, { code: "payload_too_large" });
  }

  const valid = verifyWebhook(
    {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
    raw,
    secret,
    Date.now(),
  );
  if (!valid) return reply(401, { code: "invalid_signature" });

  const event = eventSummary(raw);
  if (!event) return reply(400, { code: "invalid_body" });
  console.info("[webhook:tucopramp]", event);
  return reply(200, { received: true });
}
