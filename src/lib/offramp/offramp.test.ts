import { describe, expect, it } from "vitest";
import { isOfframpEnabled, missingOfframpEnv, offrampConfig } from "./config";
import { OFFRAMP_COPY } from "./copy";
import { normalizeBreBKey } from "./breb";
import {
  BRIDGE_KYC_ORIGIN,
  BRIDGE_TOS_ORIGIN,
  embeddedKycUrl,
  embeddedTosUrl,
  isKycFinished,
  isTosAccepted,
} from "./embed";
import {
  DOCUMENT_TYPES,
  GENERIC_ERROR,
  offrampErrorMessage,
} from "./messages";

const env = {
  OFFRAMP_ENABLED: "true",
  OFFRAMP_API_URL: "https://api.ramp.tucop.xyz/",
  OFFRAMP_DATA_CONTROLLER: "Operator",
  OFFRAMP_PRIVACY_CONTACT: "privacy@example.com",
};

describe("off-ramp config", () => {
  it("stays off unless the flag and every required variable are set", () => {
    expect(isOfframpEnabled(env)).toBe(true);
    expect(isOfframpEnabled({ ...env, OFFRAMP_ENABLED: "false" })).toBe(false);
    expect(isOfframpEnabled({ ...env, OFFRAMP_API_URL: "" })).toBe(false);
    expect(isOfframpEnabled({ ...env, OFFRAMP_DATA_CONTROLLER: " " })).toBe(false);
    expect(isOfframpEnabled({ ...env, OFFRAMP_PRIVACY_CONTACT: undefined })).toBe(false);
    expect(isOfframpEnabled({})).toBe(false);
  });

  it("only talks to the API over https, except on localhost", () => {
    expect(missingOfframpEnv({ ...env, OFFRAMP_API_URL: "http://api.example.com" })).toHaveLength(1);
    expect(missingOfframpEnv({ ...env, OFFRAMP_API_URL: "not a url" })).toHaveLength(1);
    expect(missingOfframpEnv({ ...env, OFFRAMP_API_URL: "http://localhost:3001" })).toEqual([]);
  });

  it("strips the trailing slash from the API URL", () => {
    expect(offrampConfig(env).apiUrl).toBe("https://api.ramp.tucop.xyz");
  });

  it("needs no secret: a key or database URL is never read", () => {
    const names = Object.keys(env).join(" ");
    expect(names).not.toMatch(/KEY|SECRET|DATABASE|TOKEN/);
    expect(() => offrampConfig(env)).not.toThrow();
  });
});

describe("off-ramp copy", () => {
  const blob = `${OFFRAMP_COPY.title} ${OFFRAMP_COPY.body} ${OFFRAMP_COPY.cta}`;

  it("never names a source token or network", () => {
    expect(blob).not.toMatch(/usdc|copm|usdt|celo|cusd|ccop/i);
    expect(blob).toMatch(/Bre-B/);
    expect(blob).toMatch(/Colombia/);
  });

  it("does not promise a date", () => {
    expect(blob).not.toMatch(/\d{4}|pronto|próximamente|semana|mes/i);
  });
});

describe("off-ramp error messages", () => {
  it("has Spanish copy for the codes a person can act on", () => {
    for (const code of [
      "invalid_credentials",
      "invalid_document",
      "document_already_registered",
      "destination_rejected",
      "destination_validation_timeout",
      "rate_limited_email",
    ]) {
      expect(offrampErrorMessage(code)).not.toBe(GENERIC_ERROR);
    }
  });

  it("falls back to a generic message for anything else", () => {
    expect(offrampErrorMessage("internal_error")).toBe(GENERIC_ERROR);
    expect(offrampErrorMessage(undefined)).toBe(GENERIC_ERROR);
  });

  it("does not tell the person which email holds their document", () => {
    expect(offrampErrorMessage("document_already_registered")).not.toMatch(/@/);
  });

  it("offers personal documents only", () => {
    expect(DOCUMENT_TYPES.map((type) => type.value)).toEqual([
      "CC",
      "CE",
      "PAS",
      "TI",
      "NUIP",
    ]);
  });
});

describe("Bre-B key input", () => {
  it("adds the @ to an alphanumeric key typed without it", () => {
    expect(normalizeBreBKey("juanperez")).toBe("@juanperez");
    expect(normalizeBreBKey(" juan perez1 ")).toBe("@juanperez1");
  });
  it("leaves keys that already have an @, emails, phones and documents alone", () => {
    expect(normalizeBreBKey("@juanperez")).toBe("@juanperez");
    expect(normalizeBreBKey("juan@correo.com")).toBe("juan@correo.com");
    expect(normalizeBreBKey("300 123 4567")).toBe("3001234567");
    expect(normalizeBreBKey("+573001234567")).toBe("+573001234567");
    expect(normalizeBreBKey("1020304050")).toBe("1020304050");
    expect(normalizeBreBKey("")).toBe("");
  });
});

describe("bridge pages inside the form", () => {
  const tos =
    "https://compliance.bridge.xyz/accept-terms-of-service?customer_id=c1&developer_id=d1&redirect_uri=https%3A%2F%2Fdigitalcop.shop%2Fofframp";
  const kyc =
    "https://bridge.withpersona.com/verify?fields%5Biqt_token%5D=tok&inquiry-template-id=itmpl_1&redirect-uri=https%3A%2F%2Fdigitalcop.shop%2Fofframp&reference-id=c1";

  it("frames the terms page without the redirect, so it answers by postMessage", () => {
    const url = new URL(embeddedTosUrl(tos)!);
    expect(url.origin).toBe(BRIDGE_TOS_ORIGIN);
    expect(url.searchParams.has("redirect_uri")).toBe(false);
    expect(url.searchParams.get("customer_id")).toBe("c1");
    expect(url.searchParams.get("developer_id")).toBe("d1");
  });

  it("frames the identity check as Bridge documents it", () => {
    const url = new URL(embeddedKycUrl(kyc, "https://digitalcop.shop")!);
    expect(url.origin).toBe(BRIDGE_KYC_ORIGIN);
    expect(url.pathname).toBe("/widget");
    expect(url.searchParams.get("iframe-origin")).toBe("https://digitalcop.shop");
    expect(url.searchParams.has("redirect-uri")).toBe(false);
    expect(url.searchParams.get("fields[iqt_token]")).toBe("tok");
    expect(url.searchParams.get("reference-id")).toBe("c1");
    expect(url.searchParams.get("language")).toBe("es");
  });

  it("does not frame a link on a host it does not know", () => {
    expect(embeddedTosUrl("https://dashboard.bridge.xyz/accept-terms-of-service?t=1")).toBeNull();
    expect(embeddedTosUrl(kyc)).toBeNull();
    expect(embeddedKycUrl(tos, "https://digitalcop.shop")).toBeNull();
    expect(embeddedKycUrl("https://bridge.withpersona.com/other?x=1", "https://digitalcop.shop")).toBeNull();
    expect(embeddedKycUrl("https://bridge.withpersona.com.evil.example/verify", "https://digitalcop.shop")).toBeNull();
    expect(embeddedTosUrl("not a url")).toBeNull();
    expect(embeddedTosUrl(null)).toBeNull();
    expect(embeddedKycUrl(undefined, "https://digitalcop.shop")).toBeNull();
  });

  it("only trusts messages from Bridge's own pages", () => {
    const accepted = { signedAgreementId: "a1" };
    expect(isTosAccepted({ origin: BRIDGE_TOS_ORIGIN, data: accepted })).toBe(true);
    expect(isTosAccepted({ origin: "https://evil.example", data: accepted })).toBe(false);
    expect(isTosAccepted({ origin: BRIDGE_TOS_ORIGIN, data: { signedAgreementId: "" } })).toBe(false);
    expect(isTosAccepted({ origin: BRIDGE_TOS_ORIGIN, data: null })).toBe(false);
    expect(isTosAccepted({ origin: BRIDGE_TOS_ORIGIN, data: "accepted" })).toBe(false);

    expect(isKycFinished({ origin: BRIDGE_KYC_ORIGIN, data: { name: "complete" } })).toBe(true);
    expect(isKycFinished({ origin: BRIDGE_KYC_ORIGIN, data: { name: "load" } })).toBe(false);
    expect(isKycFinished({ origin: "https://evil.example", data: { name: "complete" } })).toBe(false);
    expect(isKycFinished({ origin: BRIDGE_KYC_ORIGIN, data: null })).toBe(false);
  });
});
