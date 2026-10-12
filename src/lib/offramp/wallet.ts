import { keccak256Hex } from "./keccak";

/**
 * The ramp only checks that a wallet is shaped like an address; it does not
 * prove the person owns it. This site answers for it: the form asks for the
 * wallet twice, checks both match and shows the checksummed form before the
 * person confirms.
 */

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function isWalletAddress(value: string): boolean {
  return ADDRESS.test(value.trim());
}

/** EIP-55 mixed-case checksum of an address. */
export function toChecksumAddress(value: string): string {
  const address = value.trim();
  if (!ADDRESS.test(address)) throw new Error("Not an address");
  const lower = address.slice(2).toLowerCase();
  const hash = keccak256Hex(new TextEncoder().encode(lower));
  let out = "0x";
  for (let i = 0; i < lower.length; i++) {
    out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  }
  return out;
}

export type WalletCheck =
  | { ok: true; address: string }
  | { ok: false; reason: "empty" | "invalid" | "mismatch" | "bad_checksum" };

/**
 * Both entries must be addresses and the same ignoring case. An entry in
 * mixed case must carry a valid checksum, which catches a mistyped letter.
 */
export function checkWalletPair(first: string, second: string): WalletCheck {
  const a = first.trim();
  const b = second.trim();
  if (!a || !b) return { ok: false, reason: "empty" };
  if (!ADDRESS.test(a) || !ADDRESS.test(b)) return { ok: false, reason: "invalid" };
  if (a.toLowerCase() !== b.toLowerCase()) return { ok: false, reason: "mismatch" };
  const checksummed = toChecksumAddress(a);
  for (const entry of [a, b]) {
    const body = entry.slice(2);
    const mixed = body !== body.toLowerCase() && body !== body.toUpperCase();
    if (mixed && entry !== checksummed) return { ok: false, reason: "bad_checksum" };
  }
  return { ok: true, address: checksummed };
}
