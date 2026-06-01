import Graph from "graphology";
import { formatEther } from "viem";
import type { CalldataOfacMatch, EtherscanTokenTx, EtherscanTx, TxRow } from "../types.js";
import type { ScreenGraph, TxEdgeAttributes } from "./types.js";

const ZERO = "0x" + "0".repeat(40);

function txValueWei(tx: EtherscanTx): bigint {
  try {
    return BigInt(tx.value);
  } catch {
    return 0n;
  }
}

type BuildGraphOpts = {
  seed: string;
  txs: TxRow[];
  tokenTxs: EtherscanTokenTx[];
  contracts: Map<string, string>;
  calldataOfac: CalldataOfacMatch[];
  contractCache: Map<string, boolean>;
  nodeTags: Map<string, Set<string>>;
};

function ensureNode(
  graph: ScreenGraph,
  address: string,
  depth: number,
  isContract: boolean,
  tags: Set<string>,
): void {
  const lower = address.toLowerCase();
  if (!graph.hasNode(lower)) {
    graph.addNode(lower, { depth, tags: [...tags], isContract });
    return;
  }
  const attrs = graph.getNodeAttributes(lower);
  attrs.depth = Math.min(attrs.depth, depth);
  attrs.isContract = attrs.isContract || isContract;
  for (const t of tags) {
    if (!attrs.tags.includes(t)) attrs.tags.push(t);
  }
}

function tagsFor(nodeTags: Map<string, Set<string>>, lower: string): Set<string> {
  return new Set(nodeTags.get(lower) ?? []);
}

function formatTokenUnits(value: string, decimals: number): string {
  try {
    const v = BigInt(value);
    if (v === 0n) return "0";
    const scale = 10n ** BigInt(decimals);
    const whole = v / scale;
    const frac = v % scale;
    if (frac === 0n) return whole.toString();
    const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
    return `${whole}.${fracStr}`;
  } catch {
    return "0";
  }
}

function tokenDecimals(row: EtherscanTokenTx): number {
  const d = parseInt(row.tokenDecimal, 10);
  return Number.isFinite(d) && d >= 0 ? d : 18;
}

function addTokenEdge(
  graph: ScreenGraph,
  key: string,
  source: string,
  target: string,
  attrs: TxEdgeAttributes,
): void {
  if (graph.hasEdge(key)) return;
  graph.addEdgeWithKey(key, source, target, attrs);
}

/** Build directed weighted graph from seed txs, tokentx, and calldata virtual edges. */
export function buildGraph(opts: BuildGraphOpts): ScreenGraph {
  const graph: ScreenGraph = new Graph({ type: "directed", multi: true });
  const seedLower = opts.seed.toLowerCase();

  ensureNode(graph, opts.seed, 0, false, tagsFor(opts.nodeTags, seedLower));

  for (const tx of opts.txs) {
    const fromLower = tx.from.toLowerCase();
    const toLower = tx.to.toLowerCase();
    if (fromLower !== seedLower && toLower !== seedLower) continue;

    const peerLower = fromLower === seedLower ? toLower : fromLower;
    if (!peerLower || peerLower === ZERO) continue;

    const peerIsContract = opts.contractCache.get(peerLower) ?? false;
    ensureNode(graph, peerLower, 1, peerIsContract, tagsFor(opts.nodeTags, peerLower));

    const valueWei = txValueWei(tx);
    const edgeAttrs: TxEdgeAttributes = {
      kind: "tx",
      valueWei: valueWei.toString(),
      valueEth: tx.value_eth,
      blockNumber: tx.blockNumber,
      timeStamp: tx.timeStamp,
      tags: [...tx.categories],
      txHash: tx.hash,
    };

    if (fromLower === seedLower) {
      graph.addEdgeWithKey(tx.hash.toLowerCase(), seedLower, peerLower, edgeAttrs);
    } else {
      graph.addEdgeWithKey(tx.hash.toLowerCase(), peerLower, seedLower, edgeAttrs);
    }
  }

  for (const row of opts.tokenTxs) {
    const fromLower = row.from.toLowerCase();
    const toLower = row.to.toLowerCase();
    if (fromLower !== seedLower && toLower !== seedLower) continue;

    const contractLower = row.contractAddress.toLowerCase();
    const scLabel = opts.contracts.get(contractLower);
    const decimals = tokenDecimals(row);
    const amount = formatTokenUnits(row.value, decimals);
    const txHash = row.hash.toLowerCase();
    const tags = scLabel ? [`sc:${scLabel}`] : [];

    if (scLabel) {
      ensureNode(graph, contractLower, 1, true, tagsFor(opts.nodeTags, contractLower));
      addTokenEdge(graph, `token:sc:${txHash}:${contractLower}`, seedLower, contractLower, {
        kind: "token",
        valueWei: "0",
        valueEth: "0",
        blockNumber: "",
        timeStamp: "",
        tags,
        txHash: row.hash,
        tokenAmount: amount,
        tokenAmountRaw: row.value,
        tokenLabel: scLabel,
        tokenDecimals: decimals,
      });
    }

    const peerLower = fromLower === seedLower ? toLower : fromLower;
    if (!peerLower || peerLower === ZERO || peerLower === contractLower) continue;

    const peerIsContract = opts.contractCache.get(peerLower) ?? false;
    ensureNode(graph, peerLower, 1, peerIsContract, tagsFor(opts.nodeTags, peerLower));

    const tokenAttrs: TxEdgeAttributes = {
      kind: "token",
      valueWei: "0",
      valueEth: "0",
      blockNumber: "",
      timeStamp: "",
      tags,
      txHash: row.hash,
      tokenAmount: amount,
      tokenAmountRaw: row.value,
      tokenLabel: scLabel ?? row.tokenSymbol.toLowerCase(),
      tokenDecimals: decimals,
      tokenContract: contractLower,
    };

    if (fromLower === seedLower) {
      addTokenEdge(graph, `token:peer:${txHash}:${peerLower}:out`, seedLower, peerLower, tokenAttrs);
    } else {
      addTokenEdge(graph, `token:peer:${txHash}:${peerLower}:in`, peerLower, seedLower, tokenAttrs);
    }
  }

  for (const m of opts.calldataOfac) {
    const contractLower = m.contract.toLowerCase();
    const ofacLower = m.ofac.toLowerCase();
    const contractIsContract = opts.contractCache.get(contractLower) ?? true;

    ensureNode(
      graph,
      contractLower,
      1,
      contractIsContract,
      tagsFor(opts.nodeTags, contractLower),
    );
    ensureNode(graph, ofacLower, 1, false, tagsFor(opts.nodeTags, ofacLower));

    const edgeKey = `calldata:${m.tx_hash.toLowerCase()}:${ofacLower}`;
    if (graph.hasEdge(edgeKey)) continue;

    const refAttrs: TxEdgeAttributes = {
      kind: "calldata_ref",
      valueWei: "0",
      valueEth: "0",
      blockNumber: "",
      timeStamp: "",
      tags: ["ofac", "calldata"],
      txHash: m.tx_hash,
      tokenAmount: m.amount,
      tokenAmountRaw: m.amount_raw,
      tokenLabel: m.token_label,
    };
    graph.addEdgeWithKey(edgeKey, contractLower, ofacLower, refAttrs);
  }

  return graph;
}

export function graphMeta(graph: ScreenGraph, truncated: boolean): {
  nodeCount: number;
  edgeCount: number;
  truncated: boolean;
  maxDepth: number;
} {
  let maxDepth = 0;
  graph.forEachNode((_node, attrs) => {
    if (attrs.depth > maxDepth) maxDepth = attrs.depth;
  });
  return {
    nodeCount: graph.order,
    edgeCount: graph.size,
    truncated,
    maxDepth,
  };
}

export function formatWeiEth(wei: bigint): string {
  const s = formatEther(wei);
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}
