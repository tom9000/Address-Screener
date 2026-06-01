import type Graph from "graphology";

export type TxEdgeAttributes = {
  kind: "tx" | "calldata_ref" | "token";
  valueWei: string;
  valueEth: string;
  blockNumber: string;
  timeStamp: string;
  tags: string[];
  txHash: string;
  tokenAmount?: string;
  tokenAmountRaw?: string;
  tokenLabel?: string;
  tokenDecimals?: number;
  /** Token contract (registry) for peer token edges. */
  tokenContract?: string;
};

export type AddressNodeAttributes = {
  depth: number;
  tags: string[];
  isContract: boolean;
};

export type ScreenGraph = Graph<AddressNodeAttributes, TxEdgeAttributes>;

export type PeerExposure = "direct" | "calldata" | "defi" | null;
