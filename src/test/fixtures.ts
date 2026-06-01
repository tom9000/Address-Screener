import type { PeerSummary, ScreenOutput, TxRow } from "../types.js";

const BASE_TX: TxRow = {
  blockNumber: "1",
  timeStamp: "1",
  hash: "0x" + "a".repeat(64),
  nonce: "0",
  blockHash: "0x" + "b".repeat(64),
  transactionIndex: "0",
  from: "0x" + "1".repeat(40),
  to: "0x" + "2".repeat(40),
  value: "0",
  gas: "21000",
  gasPrice: "1",
  isError: "0",
  txreceipt_status: "1",
  input: "0x",
  contractAddress: "",
  cumulativeGasUsed: "21000",
  gasUsed: "21000",
  confirmations: "1",
  methodId: "0x",
  functionName: "",
  value_eth: "0",
  categories: [],
};

export function peer(overrides: Partial<PeerSummary> & Pick<PeerSummary, "address">): PeerSummary {
  return {
    depth: 1,
    sent_eth: "0",
    recv_eth: "0",
    linked_eth: "0",
    tx_count: 1,
    exposure: null,
    tags: [],
    ofac_entity: null,
    top_tx: null,
    link_categories: [],
    ...overrides,
  };
}

export function tx(overrides: Partial<TxRow>): TxRow {
  return { ...BASE_TX, ...overrides };
}

export function minimalScreenOutput(overrides: Partial<ScreenOutput> = {}): ScreenOutput {
  return {
    seed: "0x" + "3".repeat(40),
    calldata_ofac: [],
    peers: [],
    peer_strings: [],
    graph: { nodeCount: 0, edgeCount: 0, truncated: false, maxDepth: 0 },
    has_cex: false,
    meta: {
      txlist_count: 0,
      high_value_eth: "1",
      ofac_source: "bundled_csv",
      seed_balance_eth: "0",
    },
    txs: [],
    addresses: [],
    ...overrides,
  };
}
