export type Destination = {
  key_masked: string | null;
  bank: string | null;
  holder: string | null;
  document_last4: string | null;
};

export type Offramp = {
  address: string;
  chain: string;
  currency: string;
  token_address: string;
  destination_currency: string;
  developer_fee_percent: string;
  min_payout_cop: number;
};

export type State =
  | "signed_out"
  | "new"
  | "kyc_pending"
  | "kyc_approved"
  | "destination_pending"
  | "destination_verified"
  | "rejected"
  | "restricted";

export type Status = {
  state: State;
  email?: string;
  kyc_link?: string | null;
  tos_link?: string | null;
  kyc_status?: string | null;
  tos_status?: string | null;
  destination?: Destination | null;
  offramp?: Offramp | null;
};
