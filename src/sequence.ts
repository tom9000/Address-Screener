import { formatEther, getAddress, parseEther } from "viem";
import { HIGH_VALUE_ETH, SCAN, SEARCH_ENABLED } from "./config.js";
import { loadContractRegistry, loadXfwilRegistry } from "./data/load.js";
import { loadOfacList } from "./data/ofac-load.js";
import { scanCalldataForOfac } from "./intel/calldata-decode.js";
import { buildContractCache } from "./intel/contracts.js";
import { enrichAddresses, resolveSearchTargets, type EnrichScope } from "./intel/enrich.js";
import { aggregatePeers, selectPeersForOutput } from "./graph/aggregate.js";
import { buildGraph, graphMeta } from "./graph/build.js";
import { formatPeersCsv, hasAnyXfwilMatch } from "./graph/format.js";
import { getBalanceWei, getTokenTransfers, getTxList } from "./sources/etherscan.js";
import type { CalldataOfacMatch, EtherscanTx, ScreenOutput, TxRow } from "./types.js";

const ZERO = "0x" + "0".repeat(40);

export type RunScreenOpts = {
  seed: string;
  apiKey: string;
  searchKey?: string;
};

export async function runScreen(opts: RunScreenOpts): Promise<ScreenOutput> {
  const seed = getAddress(opts.seed);

  //
  // Step 1 — entity lists used to label addresses on txs and in the graph.
  //
  log("step 1: load OFAC + contract registry + xfwil lists");
  const ofacList = await loadOfacList();
  const { set: ofac, names: ofacNames } = ofacList;
  const contracts = loadContractRegistry();
  const xfwil = loadXfwilRegistry();
  log(`ofac=${ofac.size} (source=${ofacList.source}) contracts=${contracts.size} xfwil=${xfwil.size}`);

  //
  // Step 2 — on-chain activity for the seed (window size: TXLIST_OFFSET in config).
  //
  log("step 2: fetch txlist + ERC-20 transfers + seed balance");
  const [txs, tokenTxs, seedBalanceWei] = await Promise.all([
    getTxList(opts.seed, opts.apiKey),
    getTokenTransfers(opts.seed, opts.apiKey),
    getBalanceWei(opts.seed, opts.apiKey),
  ]);
  const seedBalanceEth = formatEther(seedBalanceWei);
  log(`txlist rows=${txs.length} tokentx rows=${tokenTxs.length} balance=${seedBalanceEth} ETH`);

  //
  // Step 3 — flag txs whose native value meets HIGH_VALUE_ETH; collect endpoints for search.
  //
  log("step 3: tag txs (high_value ≥ 1 ETH)");
  const highValueWei = parseEther(HIGH_VALUE_ETH as `${number}`);
  const taggedTxs: TxRow[] = txs.map((tx) => {
    const valueWei = txValueWei(tx);
    const categories: string[] = [];
    if (valueWei >= highValueWei) categories.push("high_value");
    return {
      ...tx,
      value_eth: formatEther(valueWei),
      categories,
    };
  });

  const highValueEndpoints = new Set<string>();
  for (const tx of taggedTxs) {
    if (!tx.categories.includes("high_value")) continue;
    for (const a of endpoints(tx)) highValueEndpoints.add(a.toLowerCase());
  }

  //
  // Step 4 — which `to` addresses behave like contracts (registry + calldata/tokentx hints).
  //
  log("step 4: contract cache from txlist + registry (no RPC)");
  const contractCache = buildContractCache(txs, tokenTxs, contracts);
  log(`contracts inferred=${contractCache.size}`);

  const addrCategories = new Map<string, Set<string>>();
  const txCalldataOfac = new Set<string>();
  const calldataOfacMatches = new Map<string, CalldataOfacMatch>();

  //
  // Step 5 — tag every tx endpoint that hits OFAC, a known contract, or a CEX hot wallet.
  //
  if (SCAN.ofacDefi.enabled) {
    log(`step 5: OFAC + contracts (${taggedTxs.length} txs)`);
    for (const tx of taggedTxs) {
      for (const addr of endpoints(tx)) {
        const lower = addr.toLowerCase();
        if (ofac.has(lower)) addCategory(addrCategories, lower, "ofac");
        const scLabel = contracts.get(lower);
        if (scLabel) addCategory(addrCategories, lower, `sc:${scLabel}`);
        if (xfwil.has(lower)) addCategory(addrCategories, lower, "cex");
      }
    }
  } else {
    log("step 5: OFAC + contracts skipped (SCAN.ofacDefi.enabled=false)");
  }

  //
  // Step 6 — OFAC addresses embedded in contract calldata (e.g. USDT transfer `to`).
  //
  if (SCAN.calldata.enabled) {
    log(`step 6: calldata scan (ABI + heuristic) (${taggedTxs.length} txs)`);
    for (const tx of taggedTxs) {
      const hits = scanCalldataForOfac({ tx, ofac, contractCache, contracts });
      for (const hit of hits) {
        addCategory(addrCategories, hit.ofac.toLowerCase(), "ofac");
        const key = `${hit.tx_hash.toLowerCase()}:${hit.ofac.toLowerCase()}`;
        calldataOfacMatches.set(key, hit);
      }
      if (hits.length > 0) txCalldataOfac.add(tx.hash);
    }
  } else {
    log("step 6: calldata scan skipped (SCAN.calldata.enabled=false)");
  }

  //
  // Step 7 — copy address-level tags (and calldata OFAC) onto each tx’s categories[].
  //
  log("step 7: merge categories onto txs");
  const outputTxs = taggedTxs.map((tx) =>
    mergeTxCategories(tx, ofac, contracts, addrCategories, txCalldataOfac),
  );

  const enrichScope: EnrichScope = {
    seed,
    ofacHitAddrs: ofacHitAddrs(addrCategories),
    highValueEndpoints,
  };

  //
  // Step 8 — 1-hop graph: native + token edges and virtual calldata→OFAC links.
  //
  log(`step 8: build graph (${outputTxs.length} txs)`);
  const graph = buildGraph({
    seed,
    txs: outputTxs,
    tokenTxs,
    contracts,
    calldataOfac: [...calldataOfacMatches.values()],
    contractCache,
    nodeTags: addrCategories,
  });

  //
  // Step 9 — roll graph into per-counterparty peers; format peer_txs strings for CSV.
  //
  log("step 9: aggregate peers");
  const txCategoriesByHash = new Map(
    outputTxs.map((tx) => [tx.hash.toLowerCase(), new Set(tx.categories)]),
  );
  const allPeers = aggregatePeers({
    graph,
    seed,
    calldataOfac: [...calldataOfacMatches.values()],
    ofac,
    contracts,
    xfwil,
    ofacNames,
    txCategoriesByHash,
  });
  const { peers, truncated } = selectPeersForOutput(allPeers, contracts);
  const graphInfo = graphMeta(graph, truncated);
  const peer_strings = formatPeersCsv(peers, xfwil, contracts, { seed, ofac, ofacNames });
  log(
    `graph nodes=${graphInfo.nodeCount} edges=${graphInfo.edgeCount} maxDepth=${graphInfo.maxDepth} peers total=${allPeers.length} flagged=${peers.length} truncated=${truncated}`,
  );

  const hasCex = hasAnyXfwilMatch(seed, txs, xfwil);

  const searchTargetCount = SEARCH_ENABLED ? resolveSearchTargets(enrichScope).size : 0;

  //
  // Step 10 — web search on seed, OFAC-listed, and high-value addresses; build addresses[].
  //
  log(`step 10: enrich search=${SEARCH_ENABLED ? "on" : "off"}(${searchTargetCount})`);

  const categoriesPlain = new Map<string, string[]>();
  for (const [addr, cats] of addrCategories) {
    categoriesPlain.set(addr, [...cats]);
  }
  for (const tx of outputTxs) {
    if (tx.categories.includes("high_value")) {
      for (const a of endpoints(tx)) {
        const lower = a.toLowerCase();
        const cur = categoriesPlain.get(lower) ?? [];
        if (!cur.includes("high_value")) {
          categoriesPlain.set(lower, [...cur, "high_value"]);
        }
      }
    }
  }

  const addresses = await enrichAddresses({
    scope: enrichScope,
    searchEnabled: SEARCH_ENABLED,
    categoriesByAddr: categoriesPlain,
    ofacNames,
    searchKey: opts.searchKey,
  });

  return {
    seed,
    calldata_ofac: [...calldataOfacMatches.values()].sort((a, b) =>
      `${a.tx_hash}:${a.contract}:${a.ofac}`.localeCompare(`${b.tx_hash}:${b.contract}:${b.ofac}`),
    ),
    peers,
    peer_strings,
    graph: graphInfo,
    has_cex: hasCex,
    meta: {
      txlist_count: txs.length,
      high_value_eth: HIGH_VALUE_ETH,
      ofac_source: ofacList.source,
      seed_balance_eth: seedBalanceEth,
    },
    txs: outputTxs,
    addresses: addresses.sort((a, b) => a.categories.join().localeCompare(b.categories.join())),
  };
}

//
//
//
// Helper Functions
//

function log(msg: string): void {
  console.error(`[screen] ${msg}`);
}

function addCategory(map: Map<string, Set<string>>, addr: string, tag: string): void {
  const lower = addr.toLowerCase();
  if (!lower || lower === ZERO) return;
  if (!map.has(lower)) map.set(lower, new Set());
  map.get(lower)!.add(tag);
}

function endpoints(tx: EtherscanTx): string[] {
  return [tx.from, tx.to].filter((a) => a && a.toLowerCase() !== ZERO);
}

function txValueWei(tx: EtherscanTx): bigint {
  try {
    return BigInt(tx.value);
  } catch {
    return 0n;
  }
}

function ofacHitAddrs(addrCategories: Map<string, Set<string>>): Set<string> {
  const out = new Set<string>();
  for (const [addr, cats] of addrCategories) {
    if (cats.has("ofac")) out.add(addr);
  }
  return out;
}

function mergeTxCategories(
  tx: TxRow,
  ofac: Set<string>,
  contracts: Map<string, string>,
  addrCategories: Map<string, Set<string>>,
  txCalldataOfac: Set<string>,
): TxRow {
  const categories = [...tx.categories];
  for (const addr of endpoints(tx)) {
    const lower = addr.toLowerCase();
    if (ofac.has(lower) && !categories.includes("ofac")) categories.push("ofac");
    const scLabel = contracts.get(lower);
    if (scLabel) {
      const tag = `sc:${scLabel}`;
      if (!categories.includes(tag)) categories.push(tag);
    }
    for (const cat of addrCategories.get(lower) ?? []) {
      if (!categories.includes(cat)) categories.push(cat);
    }
  }
  if (txCalldataOfac.has(tx.hash) && !categories.includes("ofac")) {
    categories.push("ofac");
  }
  return { ...tx, categories };
}
