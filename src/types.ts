export type EtherscanTokenTx = {
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenSymbol: string;
  tokenDecimal: string;
};

export type EtherscanTx = {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId: string;
  functionName: string;
};

export type SearchRecord = {
  results: number;
  /** e.g. http_429 when the lookup failed. */
  status?: string;
};

export type TxRow = EtherscanTx & {
  value_eth: string;
  categories: string[];
};

export type AddressRow = {
  address: string;
  categories: string[];
  ofac_entity: string | null;
  search: SearchRecord | null;
};

/** OFAC address found in tx calldata to a contract. */
export type CalldataOfacMatch = {
  contract: string;
  ofac: string;
  tx_hash: string;
  selector?: string;
  token_label?: string;
  amount_raw?: string;
  amount?: string;
  decode?: "transfer" | "transferFrom" | "heuristic";
};

export type PeerTokenLink = {
  contract_address: string;
  token_sent?: string;
  token_recv?: string;
};

export type PeerSummary = {
  address: string;
  depth: number;
  sent_eth: string;
  recv_eth: string;
  linked_eth: string;
  tx_count: number;
  exposure: "direct" | "calldata" | "defi" | null;
  tags: string[];
  ofac_entity: string | null;
  top_tx: string | null;
  /** Per-contract token volumes when this peer has token links. */
  token_links?: PeerTokenLink[];
  /** @deprecated Link-level only; merged peers use token_links. */
  contract_address?: string;
  /** @deprecated Link-level only; merged peers use token_links. */
  token_sent?: string;
  /** @deprecated Link-level only; merged peers use token_links. */
  token_recv?: string;
  link_categories: string[];
};

export type GraphMeta = {
  nodeCount: number;
  edgeCount: number;
  truncated: boolean;
  maxDepth: number;
};

export type ScreenOutput = {
  seed: string;
  calldata_ofac: CalldataOfacMatch[];
  /** 1-hop peer roll-ups (selected per GRAPH rules). */
  peers: PeerSummary[];
  /** Pipe-ready peer strings (same selection as peers). */
  peer_strings: string[];
  graph: GraphMeta;
  /** Any tx endpoint or seed matched the xfwil CEX registry. */
  has_cex: boolean;
  meta: {
    txlist_count: number;
    high_value_eth: string;
    ofac_source: string;
    seed_balance_eth: string;
  };
  txs: TxRow[];
  addresses: AddressRow[];
};
