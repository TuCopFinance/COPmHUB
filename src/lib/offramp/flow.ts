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

/** At most this many active own Bre-B keys per person (TuCOP's choice for this app). */
export const MAX_ACTIVE_KEYS = 10;

/** One of the person's own Bre-B keys, with its withdrawal address if it has one. */
export type KeyEntry = {
  /** Null for an address whose key this app cannot see (pre-registered elsewhere). */
  destination: Destination | null;
  withdrawal: Withdrawal | null;
};

export type KeyGroups = {
  /** Verified keys with an active address. */
  active: KeyEntry[];
  /** Verified keys without an address yet: they need the return wallet. */
  ready: Destination[];
  /** Keys the Bre-B directory is still checking. */
  pending: Destination[];
  /** Disabled addresses, with their key (which may have been removed too). */
  disabled: KeyEntry[];
  /** Active own keys that count toward MAX_ACTIVE_KEYS. */
  activeKeyCount: number;
};

/**
 * Sorts the person's own keys and addresses for the off-ramp screen. Both
 * lists come newest first from the ramp and keep that order. A rejected key
 * is left out: the form shows why it was refused.
 */
export function groupKeys(
  destinations: readonly Destination[],
  withdrawals: readonly Withdrawal[],
): KeyGroups {
  const own = destinations.filter((d) => d.ownership === "first_party");
  const byDestination = new Map<string, Withdrawal>();
  for (const w of withdrawals) {
    if (!byDestination.has(w.destination_id)) byDestination.set(w.destination_id, w);
  }
  const groups: KeyGroups = { active: [], ready: [], pending: [], disabled: [], activeKeyCount: 0 };
  const seen = new Set<string>();

  for (const d of own) {
    const live = d.active !== false;
    const w = byDestination.get(d.id) ?? null;
    if (w) seen.add(w.id);
    if (live && d.status !== "rejected") groups.activeKeyCount += 1;
    if (!live) {
      if (w) groups.disabled.push({ destination: d, withdrawal: w });
      continue;
    }
    if (d.status === "pending") groups.pending.push(d);
    else if (d.status === "verified") {
      if (w?.status === "active") groups.active.push({ destination: d, withdrawal: w });
      else if (w) groups.disabled.push({ destination: d, withdrawal: w });
      else groups.ready.push(d);
    }
  }
  // Addresses whose key is not in the list.
  for (const w of withdrawals) {
    if (seen.has(w.id)) continue;
    (w.status === "active" ? groups.active : groups.disabled).push({ destination: null, withdrawal: w });
  }
  return groups;
}

export function activeDeposit(deposits: readonly Deposit[]): Deposit | null {
  return deposits.find((d) => d.status === "active") ?? null;
}

/**
 * A payout from a withdrawal address, in the ramp's own statuses (the same as
 * a payment). The older Bridge drain states are still read, in case an old
 * payout carries one. Anything unknown is still in progress.
 */
export type PayoutPhase = "processing" | "paid" | "failed" | "returned" | "canceled";

const PAYOUT_PHASES: Record<string, PayoutPhase> = {
  processing: "processing",
  completed: "paid",
  failed: "failed",
  refunded: "returned",
  canceled: "canceled",
  // Bridge's drain states, from before the ramp mapped them.
  payment_processed: "paid",
  undeliverable: "failed",
  error: "failed",
  missing_return_policy: "failed",
  refund_failed: "failed",
  returned: "returned",
};

export function payoutPhase(status: string): PayoutPhase {
  return PAYOUT_PHASES[status] ?? "processing";
}

/** "entre 15 y 30 minutos", from a withdrawal's or quote's settlement_time. */
export function settlementWindow(
  time: { min_minutes: number; max_minutes: number } | null | undefined,
): string | null {
  if (!time || !Number.isFinite(time.min_minutes) || !Number.isFinite(time.max_minutes)) {
    return null;
  }
  const { min_minutes: min, max_minutes: max } = time;
  if (max <= 0) return null;
  const unit = (n: number) => (n === 1 ? "minuto" : "minutos");
  if (min === max) return `${max} ${unit(max)}`;
  return `entre ${min} y ${max} ${unit(max)}`;
}

/**
 * What the identity step shows. TuCOPRamp decides the statuses; the local
 * flags only move the screen on before the next poll.
 * - `terms`, `identity`: a Bridge page to fill in.
 * - `reviewing`: Bridge is reviewing what the person sent.
 * - `cop`: identity is approved but enabling Colombia needs something more,
 *   in a page the ramp returns again in `links.kyc`.
 * - `cop_review`: the person sent that page; Bridge is reviewing it.
 * - `enabling`: Bridge is enabling Colombia by itself.
 * - `stuck`: the ramp gave no page to fill in; only support can help.
 */
export type KycStep =
  | "terms"
  | "identity"
  | "reviewing"
  | "cop"
  | "cop_review"
  | "enabling"
  | "stuck";

export function kycStep(
  party: Party,
  local: { termsAccepted: boolean; identitySent: boolean },
): KycStep {
  const termsDone = party.status.tos === "accepted" || local.termsAccepted;
  if (!termsDone) return party.links.tos ? "terms" : "stuck";
  if (party.status.kyc === "approved") {
    if (!party.links.kyc) return "enabling";
    return local.identitySent ? "cop_review" : "cop";
  }
  if (party.status.kyc === "under_review" || local.identitySent) return "reviewing";
  return party.links.kyc ? "identity" : "stuck";
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
