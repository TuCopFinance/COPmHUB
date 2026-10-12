import type {
  Deposit,
  Destination,
  Party,
  Stage,
  Withdrawal,
} from "@/components/offramp/types";

/**
 * Where Bridge sends the person back after identity verification. It must be
 * one of the return URLs TuCOP has on file for the TuCOP Ramp integrator.
 */
export const OFFRAMP_RETURN_URL = "https://digitalcop.shop/offramp";

/** Version of the consent text in the "Tus datos" step. Change it with the text. */
export const CONSENT_VERSION = "digitalcop-2026-10-11";

/** Stage from GET /v1/parties/me. TuCOPRamp, reading Bridge, is the source of truth. */
export function stageOf(party: Party): Stage {
  const cop = party.status.endorsements.find((e) => e.name === "cop")?.status;
  if (party.status.kyc === "rejected") return "rejected";
  if (party.restricted || party.status.kyc === "suspended" || cop === "revoked") {
    return "restricted";
  }
  const ready =
    party.status.kyc === "approved" && party.status.tos === "accepted" && cop === "approved";
  return ready ? "verified" : "kyc";
}

export function copEndorsement(party: Party): string | null {
  return party.status.endorsements.find((e) => e.name === "cop")?.status ?? null;
}

/** The first-party Bre-B key the off-ramp works with, if any. */
export function currentDestination(
  destinations: readonly Destination[],
  withdrawals: readonly Withdrawal[],
): Destination | null {
  const own = destinations.filter((d) => d.ownership === "first_party");
  const active = withdrawals.find((w) => w.status === "active");
  if (active) {
    const linked = own.find((d) => d.id === active.destination_id);
    if (linked) return linked;
  }
  // The list is newest first. A verified key wins over a newer pending one,
  // as on ramp.tucop.xyz.
  return (
    own.find((d) => d.status === "verified") ??
    own.find((d) => d.status === "pending") ??
    null
  );
}

export function activeWithdrawal(
  withdrawals: readonly Withdrawal[],
  destinationId: string | null,
): Withdrawal | null {
  return (
    withdrawals.find(
      (w) => w.status === "active" && (!destinationId || w.destination_id === destinationId),
    ) ?? null
  );
}

export function activeDeposit(deposits: readonly Deposit[]): Deposit | null {
  return deposits.find((d) => d.status === "active") ?? null;
}

/**
 * How a payout from the withdrawal address reads, from Bridge's drain state
 * (mapping agreed with TuCOP Ramp). Anything unknown is still processing.
 */
export type PayoutPhase = "waiting" | "processing" | "paid" | "failed" | "returned" | "canceled";

const PAYOUT_PHASES: Record<string, PayoutPhase> = {
  awaiting_funds: "waiting",
  in_review: "processing",
  funds_received: "processing",
  payment_submitted: "processing",
  refund_in_flight: "processing",
  payment_processed: "paid",
  undeliverable: "failed",
  error: "failed",
  missing_return_policy: "failed",
  refund_failed: "failed",
  returned: "returned",
  refunded: "returned",
  canceled: "canceled",
};

export function payoutPhase(state: string): PayoutPhase {
  return PAYOUT_PHASES[state] ?? "processing";
}

/** "25.391500" USDC as "25,3915". */
export function formatUsdc(amount: string | null | undefined): string | null {
  if (!amount) return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return value.toLocaleString("es-CO", { maximumFractionDigits: 6 });
}

/** "150" basis points as "1,5". */
export function feePercent(bps: number | null | undefined): string | null {
  if (bps === null || bps === undefined || !Number.isFinite(bps)) return null;
  return (bps / 100).toLocaleString("es-CO", { maximumFractionDigits: 2 });
}

/** "4000.00" COP as "4.000". */
export function formatCop(amount: string | null | undefined): string | null {
  if (!amount) return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return Math.round(value).toLocaleString("es-CO");
}
