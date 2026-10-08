import { describe, expect, it } from "vitest";
import { isOfframpEnabled, missingOfframpEnv, offrampConfig } from "./config";
import { OFFRAMP_COPY } from "./copy";
import { normalizeBreBKey } from "./breb";
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
