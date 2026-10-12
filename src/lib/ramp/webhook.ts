import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Standard Webhooks check for TuCOPRamp events: HMAC-SHA256 of
 * `<webhook-id>.<webhook-timestamp>.<raw body>`, keyed with the decoded
 * `whsec_` secret, sent as a space-separated list of `v1,<base64>`. Any one
 * match is enough (two are sent for a while after a secret rotation).
 */

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
export const MAX_WEBHOOK_BYTES = 256 * 1024;

export type WebhookHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export function verifyWebhook(
  headers: WebhookHeaders,
  rawBody: string,
  secret: Uint8Array,
  nowMs: number,
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  const age = Math.abs(nowMs / 1000 - Number(timestamp));
  if (age > WEBHOOK_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret)
    .update(`${id}.${timestamp}.${rawBody}`, "utf8")
    .digest();
  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/**
 * Event type and id, the only things worth logging: events carry ids and
 * statuses, and the details are read through the API.
 */
export function eventSummary(rawBody: string): { id: string; type: string } | null {
  try {
    const event = JSON.parse(rawBody) as { id?: unknown; type?: unknown };
    if (typeof event.id !== "string" || typeof event.type !== "string") return null;
    return { id: event.id.slice(0, 64), type: event.type.slice(0, 64) };
  } catch {
    return null;
  }
}
