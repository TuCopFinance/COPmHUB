/** The TuCOPRamp platform objects the form reads (fields it does not use are left out). */

export type KycStatus =
  | "not_started"
  | "incomplete"
  | "under_review"
  | "approved"
  | "rejected"
  | "suspended";

export type Party = {
  id: string;
  status: {
    kyc: KycStatus;
    tos: "pending" | "accepted";
    endorsements: { name: string; status: "pending" | "approved" | "revoked" }[];
  };
  restricted: boolean;
  links: { kyc: string | null; tos: string | null };
};

export type Destination = {
  id: string;
  ownership: "first_party" | "third_party";
  status: "pending" | "verified" | "rejected";
  key_masked: string | null;
  holder: { name: string | null; bank: string | null; document_last4: string | null } | null;
  rejection_reason: string | null;
  confirmed_at: string | null;
  created_at: string;
};

export type Amount = { amount: string; asset: string };

export type Withdrawal = {
  id: string;
  status: "active" | "disabled";
  destination_id: string;
  deposit: {
    address: string;
    chain: string;
    asset: string;
    token_contract: string;
    minimum_destination_amount: Amount;
  };
  fee_bps: number | null;
  return_address: string | null;
  /** Most recent first. Only on GET /v1/withdrawals/{id}. */
  payouts?: Payout[];
};

export type Payout = {
  id: string;
  /** Bridge's state for the payout. */
  status: string;
  amount: Amount | null;
  destination_amount: Amount | null;
  created_at: string;
  updated_at: string;
};

/** A withdraw quote is only a price: send at least source_amount. */
export type Quote = {
  id: string;
  destination_amount: Amount;
  source_amount: Amount;
  rate: { value: string };
  expires_at: string;
};

export type Deposit = {
  id: string;
  status: "active" | "deactivated";
  deposit_instructions: {
    bre_b_key: string;
    account_holder_name: string | null;
    bank_name: string | null;
  };
  destination: { address: string; chain: string; asset: string; token_contract: string };
  fee_bps: number;
};

export type DocumentType = { code: string; name: string; hint: string };

/** Where the person is, worked out from what the ramp answers. */
export type Stage =
  | "loading"
  | "signed_out"
  | "new"
  | "kyc"
  | "rejected"
  | "restricted"
  | "verified";
