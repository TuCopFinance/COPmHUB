import { describe, expect, it } from "vitest";
import { checkWalletPair, isWalletAddress, toChecksumAddress } from "./wallet";
import { keccak256Hex } from "./keccak";
import {
  MAX_ACTIVE_KEYS,
  activeDeposit,
  feePercent,
  formatCop,
  formatUsdc,
  groupKeys,
  kycStep,
  payoutPhase,
  settlementWindow,
  stageOf,
} from "./flow";
import { offrampErrorMessage, GENERIC_ERROR, isOfferedDocument } from "./messages";
import type { Destination, Party, Withdrawal } from "@/components/offramp/types";

describe("keccak-256", () => {
  it("matches known digests", () => {
    const hex = (s: string) => keccak256Hex(new TextEncoder().encode(s));
    expect(hex("")).toBe("c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
    expect(hex("abc")).toBe("4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45");
    expect(hex("The quick brown fox jumps over the lazy dog")).toBe(
      "4d741b6f1eb29cb2a9b9911c82f56fa8d73b04959d3d9d222895df6c0b28aa15",
    );
  });
});

describe("wallet checks", () => {
  // EIP-55 test vectors.
  const vectors = [
    "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
    "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
    "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
  ];

  it("checksums addresses as EIP-55 does", () => {
    for (const v of vectors) expect(toChecksumAddress(v.toLowerCase())).toBe(v);
  });

  it("accepts the same address typed twice, in any case", () => {
    const [v] = vectors;
    expect(checkWalletPair(v.toLowerCase(), v.toUpperCase().replace("0X", "0x"))).toEqual({
      ok: true,
      address: v,
    });
  });

  it("catches a mismatch, a bad shape and a mistyped mixed-case address", () => {
    const [v, w] = vectors;
    expect(checkWalletPair(v, w)).toEqual({ ok: false, reason: "mismatch" });
    expect(checkWalletPair("0x123", "0x123")).toEqual({ ok: false, reason: "invalid" });
    expect(checkWalletPair("", v)).toEqual({ ok: false, reason: "empty" });
    const typo = v.slice(0, 3) + v[3].toUpperCase() + v.slice(4); // "a" -> "A" breaks the checksum
    expect(checkWalletPair(typo, typo)).toEqual({ ok: false, reason: "bad_checksum" });
    expect(isWalletAddress(` ${v} `)).toBe(true);
  });
});

function party(over: Partial<Party["status"]> = {}, restricted = false): Party {
  return {
    id: "pty_x",
    restricted,
    links: { kyc: null, tos: null },
    status: {
      kyc: "approved",
      tos: "accepted",
      endorsements: [{ name: "cop", status: "approved" }],
      ...over,
    },
  };
}

function destination(id: string, over: Partial<Destination> = {}): Destination {
  return {
    id,
    ownership: "first_party",
    status: "verified",
    key_masked: "****1234",
    holder: null,
    rejection_reason: null,
    confirmed_at: null,
    created_at: "2026-10-11T00:00:00Z",
    ...over,
  };
}

describe("flow state", () => {
  it("is verified only with KYC approved, terms accepted and cop approved", () => {
    expect(stageOf(party())).toBe("verified");
    expect(stageOf(party({ tos: "pending" }))).toBe("kyc");
    expect(stageOf(party({ kyc: "under_review" }))).toBe("kyc");
    expect(stageOf(party({ endorsements: [{ name: "cop", status: "pending" }] }))).toBe("kyc");
    expect(stageOf(party({ endorsements: [] }))).toBe("kyc");
    expect(stageOf(party({ kyc: "rejected" }))).toBe("rejected");
    expect(stageOf(party({ kyc: "suspended" }))).toBe("restricted");
    expect(stageOf(party({ endorsements: [{ name: "cop", status: "revoked" }] }))).toBe("restricted");
    expect(stageOf(party({}, true))).toBe("restricted");
  });

  it("sorts own keys into active, ready, pending and disabled", () => {
    const a = destination("dst_a");
    const b = destination("dst_b", { status: "pending" });
    const c = destination("dst_c");
    const d = destination("dst_d");
    const gone = destination("dst_e", { active: false, disabled_at: "2026-10-14T00:00:00Z" });
    const goneNoAddress = destination("dst_f", { active: false });
    const rejected = destination("dst_r", { status: "rejected" });
    const third = destination("dst_t", { ownership: "third_party" });
    const w = (id: string, dst: string, status: "active" | "disabled") =>
      ({ id, status, destination_id: dst }) as Withdrawal;
    const groups = groupKeys(
      [a, b, c, d, gone, goneNoAddress, rejected, third],
      [
        w("wdr_a", "dst_a", "active"),
        w("wdr_d", "dst_d", "disabled"),
        w("wdr_e", "dst_e", "disabled"),
        w("wdr_x", "dst_unknown", "active"),
      ],
    );
    expect(groups.active.map((e) => e.withdrawal?.id)).toEqual(["wdr_a", "wdr_x"]);
    expect(groups.active[1].destination).toBeNull();
    expect(groups.ready.map((x) => x.id)).toEqual(["dst_c"]);
    expect(groups.pending.map((x) => x.id)).toEqual(["dst_b"]);
    expect(groups.disabled.map((e) => e.withdrawal?.id)).toEqual(["wdr_d", "wdr_e"]);
    // a, b, c and d are active keys; removed, rejected and third-party ones do not count.
    expect(groups.activeKeyCount).toBe(4);
    expect(MAX_ACTIVE_KEYS).toBe(10);
  });

  it("reads payouts in the ramp's statuses, and the older drain states", () => {
    expect(payoutPhase("processing")).toBe("processing");
    expect(payoutPhase("completed")).toBe("paid");
    expect(payoutPhase("failed")).toBe("failed");
    expect(payoutPhase("refunded")).toBe("returned");
    expect(payoutPhase("canceled")).toBe("canceled");
    expect(payoutPhase("payment_processed")).toBe("paid");
    expect(payoutPhase("undeliverable")).toBe("failed");
    expect(payoutPhase("something_new")).toBe("processing");
  });

  it("says how long the pesos take", () => {
    expect(settlementWindow({ min_minutes: 15, max_minutes: 30 })).toBe("entre 15 y 30 minutos");
    expect(settlementWindow({ min_minutes: 5, max_minutes: 5 })).toBe("5 minutos");
    expect(settlementWindow(null)).toBeNull();
    expect(settlementWindow(undefined)).toBeNull();
  });

  it("picks the identity step from the ramp's statuses and links", () => {
    const local = { termsAccepted: false, identitySent: false };
    const withLinks = (status: Partial<Party["status"]>, kyc: string | null, tos: string | null) => ({
      ...party(status),
      links: { kyc, tos },
    });
    expect(kycStep(withLinks({ tos: "pending", kyc: "not_started" }, "k", "t"), local)).toBe("terms");
    expect(
      kycStep(withLinks({ tos: "pending", kyc: "not_started" }, "k", "t"), {
        ...local,
        termsAccepted: true,
      }),
    ).toBe("identity");
    expect(kycStep(withLinks({ kyc: "incomplete" }, "k", null), local)).toBe("identity");
    expect(kycStep(withLinks({ kyc: "under_review" }, "k", null), local)).toBe("reviewing");
    expect(kycStep(withLinks({ kyc: "not_started" }, "k", null), { ...local, identitySent: true })).toBe(
      "reviewing",
    );
    const copPending = { endorsements: [{ name: "cop", status: "pending" as const }] };
    expect(kycStep(withLinks(copPending, null, null), local)).toBe("enabling");
    expect(kycStep(withLinks(copPending, "k", null), local)).toBe("cop");
    expect(kycStep(withLinks(copPending, "k", null), { ...local, identitySent: true })).toBe(
      "cop_review",
    );
    expect(kycStep(withLinks({ kyc: "incomplete" }, null, null), local)).toBe("stuck");
    expect(kycStep(withLinks({ tos: "pending" }, null, null), local)).toBe("stuck");
  });

  it("never offers the tarjeta de identidad", () => {
    expect(isOfferedDocument("TI")).toBe(false);
    expect(isOfferedDocument("ti")).toBe(false);
    expect(isOfferedDocument("CC")).toBe(true);
  });

  it("formats the fee and amounts for Colombia", () => {
    expect(formatUsdc("25.391500")).toBe("25,3915");
    expect(formatUsdc(null)).toBeNull();
    expect(feePercent(150)).toBe("1,5");
    expect(feePercent(null)).toBeNull();
    expect(formatCop("4000.00")).toBe("4.000");
    expect(activeDeposit([])).toBeNull();
  });
});

describe("error copy", () => {
  it("has Spanish copy for every code the ramp can answer here", () => {
    for (const code of [
      "party_session_required",
      "party_session_invalid",
      "party_required",
      "invalid_document",
      "document_already_registered",
      "party_identity_not_proven",
      "kyc_not_approved",
      "party_not_verified",
      "destination_rejected",
      "destination_not_verified",
      "invalid_wallet_address",
      "invalid_return_address",
      "wallet_address_required",
      "return_address_required",
      "provider_rejected",
      "provider_unavailable",
      "rate_limited_email",
      "rate_limited_party_session",
      "invalid_code",
      "amount_below_minimum",
      "amount_not_settleable",
      "rate_unavailable",
      "withdrawal_not_found",
      "idempotency_in_progress",
      "party_not_linked",
      "destination_in_use",
      "destination_limit_reached",
    ]) {
      expect(offrampErrorMessage(code), code).not.toBe(GENERIC_ERROR);
    }
  });
});
