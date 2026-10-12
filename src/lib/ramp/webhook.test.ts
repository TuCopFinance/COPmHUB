import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { webhookSecret } from "../offramp/config";
import { eventSummary, verifyWebhook } from "./webhook";

// Test vector published with the Standard Webhooks spec.
const SECRET = webhookSecret({ TUCOPRAMP_WEBHOOK_SECRET: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw" })!;
const ID = "msg_p5jXN8AQM9LWM0D4loKWxJek";
const TS = "1614265330";
const BODY = '{"test": 2432232314}';
const SIG = "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=";
const NOW = Number(TS) * 1000;

describe("webhook signature", () => {
  it("accepts the Standard Webhooks test vector", () => {
    expect(verifyWebhook({ id: ID, timestamp: TS, signature: SIG }, BODY, SECRET, NOW)).toBe(true);
  });

  it("accepts any one matching signature after a rotation", () => {
    const signature = `v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= ${SIG}`;
    expect(verifyWebhook({ id: ID, timestamp: TS, signature }, BODY, SECRET, NOW)).toBe(true);
  });

  it("refuses a changed body, id or timestamp, another secret or a missing header", () => {
    const h = { id: ID, timestamp: TS, signature: SIG };
    expect(verifyWebhook(h, '{"test": 2432232315}', SECRET, NOW)).toBe(false);
    expect(verifyWebhook({ ...h, id: "msg_other" }, BODY, SECRET, NOW)).toBe(false);
    expect(verifyWebhook({ ...h, timestamp: "1614265331" }, BODY, SECRET, NOW + 1000)).toBe(false);
    const other = webhookSecret({ TUCOPRAMP_WEBHOOK_SECRET: "whsec_c2VjcmV0" })!;
    expect(verifyWebhook(h, BODY, other, NOW)).toBe(false);
    expect(verifyWebhook({ ...h, signature: null }, BODY, SECRET, NOW)).toBe(false);
    expect(verifyWebhook({ ...h, signature: "v2," + SIG.slice(3) }, BODY, SECRET, NOW)).toBe(false);
  });

  it("refuses an attempt signed more than five minutes away", () => {
    const h = { id: ID, timestamp: TS, signature: SIG };
    expect(verifyWebhook(h, BODY, SECRET, NOW + 5 * 60 * 1000)).toBe(true);
    expect(verifyWebhook(h, BODY, SECRET, NOW + 5 * 60 * 1000 + 1001)).toBe(false);
    expect(verifyWebhook(h, BODY, SECRET, NOW - 5 * 60 * 1000 - 1001)).toBe(false);
  });

  it("signs a fresh event the way the route checks it", () => {
    const body = JSON.stringify({ id: "evt_1", type: "ping", data: {} });
    const ts = "1791407052";
    const sig = createHmac("sha256", SECRET).update(`evt_1.${ts}.${body}`).digest("base64");
    expect(
      verifyWebhook({ id: "evt_1", timestamp: ts, signature: `v1,${sig}` }, body, SECRET, 1791407052000),
    ).toBe(true);
  });

  it("reads only the event id and type", () => {
    expect(
      eventSummary('{"id":"evt_1","type":"party.updated","data":{"party_id":"pty_x"}}'),
    ).toEqual({ id: "evt_1", type: "party.updated" });
    expect(eventSummary("not json")).toBeNull();
    expect(eventSummary('{"id":1}')).toBeNull();
  });

  it("needs a whsec_ secret", () => {
    expect(webhookSecret({})).toBeNull();
    expect(webhookSecret({ TUCOPRAMP_WEBHOOK_SECRET: "MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw" })).toBeNull();
    expect(webhookSecret({ TUCOPRAMP_WEBHOOK_SECRET: "whsec_" })).toBeNull();
  });
});
