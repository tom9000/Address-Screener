// ═══ Settings ══════════════════════════════════════════════════════

/** Most recent normal txs from Etherscan txlist. */
export const TXLIST_OFFSET = 200;

/** Tx native value ≥ this (ETH) gets category `high_value`. */
export const HIGH_VALUE_ETH = "1";

/** OFAC/DeFi + calldata scans (full txlist). */
export const SCAN = {
  ofacDefi: { enabled: true },
  calldata: { enabled: true },
} as const;

/** Graph build + peer aggregation (Phase A: 1-hop star from seed). */
export const GRAPH = {
  /** Cap peer rows in output (matches txlist window; raise if graph expands in Phase B). */
  maxPeers: TXLIST_OFFSET,
} as const;

/** Web search on seed, OFAC-listed, and high-value addresses. */
export const SEARCH_ENABLED = true;

export const MAX_SEARCH_PROBES = 30;

export const SEARCH = {
  // serper → SERPER_SEARCH_API_KEY  (2.5k free queries, Google results)
  serper: { enabled: true },
  // brave  → BRAVE_SEARCH_API_KEY   (~1k/mo free credits, independent index)
  // brave: { enabled: true },
} as const;


//
//
//
// ═══ Types & internals (usually leave alone) ════════════════════════════════

export type SearchProvider = keyof typeof SEARCH;

/** USDC/USDT decimals — addresses live in data/contracts.json (labels usdc, usdt). */
export const STABLECOIN_DECIMALS = 6;

export const ETHERSCAN_THROTTLE_MS = 350;
export const ETHERSCAN_FETCH_TIMEOUT_MS = 12_000;
export const SEARCH_THROTTLE_MS = 500;
export const SEARCH_FETCH_TIMEOUT_MS = 12_000;
