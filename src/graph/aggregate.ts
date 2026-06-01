import { getAddress } from "viem";
import { GRAPH } from "../config.js";
import type { CalldataOfacMatch, PeerSummary, PeerTokenLink } from "../types.js";
import { formatWeiEth } from "./build.js";
import type { PeerExposure, ScreenGraph } from "./types.js";

function checksumNode(node: string): string {
  return getAddress(node);
}

type LinkAcc = {
  peerLower: string;
  contractLower: string | null;
  sentWei: bigint;
  recvWei: bigint;
  txHashes: Set<string>;
  topTx: string | null;
  topTxWei: bigint;
  tags: Set<string>;
  depth: number;
  tokenSentRaw: bigint;
  tokenRecvRaw: bigint;
  tokenDecimals: number;
  exposure: PeerExposure;
  hasLedgerEdge: boolean;
  linkCategories: Set<string>;
};

export type AggregatePeersOpts = {
  graph: ScreenGraph;
  seed: string;
  calldataOfac: CalldataOfacMatch[];
  ofac: Set<string>;
  contracts: Map<string, string>;
  xfwil: Map<string, string>;
  ofacNames: Map<string, string>;
  txCategoriesByHash: Map<string, Set<string>>;
};

function linkKey(peerLower: string, contractLower: string | null): string {
  return contractLower ? `${peerLower}:${contractLower}` : `${peerLower}:native`;
}

function betterExposure(current: PeerExposure, next: PeerExposure): PeerExposure {
  const rank = (e: PeerExposure) =>
    e === "direct" ? 3 : e === "calldata" ? 2 : e === "defi" ? 1 : 0;
  return rank(next) > rank(current) ? next : current;
}

function exposureForLink(
  peerLower: string,
  ofac: Set<string>,
  calldataOfac: CalldataOfacMatch[],
  hasLedgerEdge: boolean,
): PeerExposure {
  const cal = calldataOfac.some((m) => m.ofac.toLowerCase() === peerLower);
  if (cal && !hasLedgerEdge) return "calldata";
  if (ofac.has(peerLower) && hasLedgerEdge) return "direct";
  if (cal) return "calldata";
  return null;
}

function accFor(
  map: Map<string, LinkAcc>,
  peerLower: string,
  contractLower: string | null,
  depth: number,
): LinkAcc {
  const key = linkKey(peerLower, contractLower);
  let acc = map.get(key);
  if (!acc) {
    acc = {
      peerLower,
      contractLower,
      sentWei: 0n,
      recvWei: 0n,
      txHashes: new Set(),
      topTx: null,
      topTxWei: 0n,
      tags: new Set(),
      depth,
      exposure: null,
      hasLedgerEdge: false,
      tokenSentRaw: 0n,
      tokenRecvRaw: 0n,
      tokenDecimals: 18,
      linkCategories: new Set(),
    };
    map.set(key, acc);
  }
  return acc;
}

function parseEthToWei(s: string): bigint {
  if (!s || s === "0") return 0n;
  if (!s.includes(".")) return BigInt(s) * 10n ** 18n;
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded);
}

function mergeLinkCategories(
  acc: LinkAcc,
  attrs: { txHash: string; tags: string[] },
  txCategoriesByHash: Map<string, Set<string>>,
): void {
  for (const t of attrs.tags) acc.linkCategories.add(t);
  for (const c of txCategoriesByHash.get(attrs.txHash.toLowerCase()) ?? []) {
    acc.linkCategories.add(c);
  }
}

function applyEdge(
  acc: LinkAcc,
  attrs: {
    kind: string;
    valueWei: string;
    txHash: string;
    tags: string[];
    tokenAmountRaw?: string;
    tokenDecimals?: number;
  },
  direction: "out" | "in",
  txCategoriesByHash: Map<string, Set<string>>,
): void {
  acc.hasLedgerEdge = true;
  acc.txHashes.add(attrs.txHash);
  mergeLinkCategories(acc, attrs, txCategoriesByHash);

  if (attrs.kind === "tx") {
    const wei = BigInt(attrs.valueWei);
    if (direction === "out") acc.sentWei += wei;
    else acc.recvWei += wei;
    if (wei >= acc.topTxWei) {
      acc.topTxWei = wei;
      acc.topTx = attrs.txHash;
    }
  }

  if (attrs.kind === "token") {
    const raw = BigInt(attrs.tokenAmountRaw ?? "0");
    if (direction === "out") acc.tokenSentRaw += raw;
    else acc.tokenRecvRaw += raw;
    if (attrs.tokenDecimals !== undefined) acc.tokenDecimals = attrs.tokenDecimals;
    if (!acc.topTx) acc.topTx = attrs.txHash;
  }

  for (const t of attrs.tags) acc.tags.add(t);
}

const OUTPUT_PEER_FLAGS = new Set(["high_value", "ofac", "cex"]);

function hasOutputFlag(categories: Iterable<string>): boolean {
  for (const c of categories) {
    if (OUTPUT_PEER_FLAGS.has(c)) return true;
  }
  return false;
}

/** Peers with OFAC/cex/high_value, or sc link only when a linking tx carries one of those flags. */
function shouldIncludePeer(p: PeerSummary, _contracts: Map<string, string>): boolean {
  if (p.tags.includes("ofac")) return true;
  if (p.tags.includes("cex")) return true;
  if (p.tags.includes("high_value") || p.link_categories.includes("high_value")) return true;

  const tokenLinks = peerTokenLinks(p);
  if (tokenLinks.length === 0) return false;
  return hasOutputFlag(p.link_categories) || hasOutputFlag(p.tags);
}

function peerTokenLinks(p: PeerSummary): PeerTokenLink[] {
  if (p.token_links?.length) return p.token_links;
  if (p.contract_address) {
    return [
      {
        contract_address: p.contract_address,
        token_sent: p.token_sent,
        token_recv: p.token_recv,
      },
    ];
  }
  return [];
}

function betterExposureSummary(
  current: PeerSummary["exposure"],
  next: PeerSummary["exposure"],
): PeerSummary["exposure"] {
  const rank = (e: PeerSummary["exposure"]) =>
    e === "direct" ? 3 : e === "calldata" ? 2 : e === "defi" ? 1 : 0;
  return rank(next) > rank(current) ? next : current;
}

/** Roll link-level peers into one row per counterparty address. */
function mergePeersByAddress(links: PeerSummary[]): PeerSummary[] {
  const byAddr = new Map<string, PeerSummary[]>();
  for (const p of links) {
    const group = byAddr.get(p.address) ?? [];
    group.push(p);
    byAddr.set(p.address, group);
  }

  const merged: PeerSummary[] = [];
  for (const group of byAddr.values()) {
    if (group.length === 1) {
      const only = group[0]!;
      merged.push({
        ...only,
        token_links: peerTokenLinks(only),
        contract_address: undefined,
        token_sent: undefined,
        token_recv: undefined,
      });
      continue;
    }

    const first = group[0]!;
    let sentWei = 0n;
    let recvWei = 0n;
    let txCount = 0;
    const tags = new Set<string>();
    const linkCategories = new Set<string>();
    let exposure: PeerSummary["exposure"] = null;
    const tokenLinks: PeerTokenLink[] = [];

    for (const p of group) {
      sentWei += parseEthToWei(p.sent_eth);
      recvWei += parseEthToWei(p.recv_eth);
      txCount += p.tx_count;
      for (const t of p.tags) tags.add(t);
      for (const c of p.link_categories) linkCategories.add(c);
      exposure = betterExposureSummary(exposure, p.exposure);
      for (const link of peerTokenLinks(p)) tokenLinks.push(link);
    }

    merged.push({
      address: first.address,
      depth: Math.min(...group.map((p) => p.depth)),
      sent_eth: formatWeiEth(sentWei),
      recv_eth: formatWeiEth(recvWei),
      linked_eth: formatWeiEth(sentWei + recvWei),
      tx_count: txCount,
      exposure,
      tags: [...tags].sort(),
      ofac_entity: group.find((p) => p.ofac_entity)?.ofac_entity ?? null,
      top_tx: group.find((p) => p.top_tx)?.top_tx ?? null,
      token_links: tokenLinks.length ? tokenLinks : undefined,
      link_categories: [...linkCategories].sort(),
    });
  }

  return merged;
}

function formatTokenAmount(raw: bigint, decimals: number): string | undefined {
  if (raw === 0n) return undefined;
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const frac = raw % scale;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

function isContractOnlyNode(lower: string, contracts: Map<string, string>): boolean {
  return contracts.has(lower);
}

/** contract (lowercase) → OFAC address seen in calldata to that contract */
function buildCalldataContractOfacMap(
  calldataOfac: CalldataOfacMatch[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of calldataOfac) {
    const contractLower = m.contract.toLowerCase();
    if (!map.has(contractLower)) map.set(contractLower, m.ofac.toLowerCase());
  }
  return map;
}

/** Route ledger edges to calldata contract onto (ofac, contract) link. */
function resolveLinkTarget(
  peerLower: string,
  contractLower: string | null,
  calldataContractOfac: Map<string, string>,
): { peerLower: string; contractLower: string | null } {
  if (contractLower !== null) return { peerLower, contractLower };
  const ofacLower = calldataContractOfac.get(peerLower);
  if (ofacLower) return { peerLower: ofacLower, contractLower: peerLower };
  return { peerLower, contractLower };
}

/** 1-hop roll-up keyed by counterparty + optional token contract. */
export function aggregatePeers(opts: AggregatePeersOpts): PeerSummary[] {
  const seedLower = opts.seed.toLowerCase();
  const byLink = new Map<string, LinkAcc>();
  const calldataContractOfac = buildCalldataContractOfacMap(opts.calldataOfac);

  const linkAcc = (
    peerLower: string,
    contractLower: string | null,
    depth: number,
  ): LinkAcc => {
    const resolved = resolveLinkTarget(peerLower, contractLower, calldataContractOfac);
    return accFor(byLink, resolved.peerLower, resolved.contractLower, depth);
  };

  if (opts.graph.hasNode(seedLower)) {
    for (const edge of opts.graph.outEdges(seedLower)) {
      const attrs = opts.graph.getEdgeAttributes(edge);
      const target = opts.graph.target(edge);
      if (target === seedLower) continue;

      if (attrs.kind === "tx") {
        if (isContractOnlyNode(target, opts.contracts)) continue;
        const acc = linkAcc(target, null, opts.graph.getNodeAttributes(target).depth);
        applyEdge(acc, attrs, "out", opts.txCategoriesByHash);
        for (const t of opts.graph.getNodeAttributes(target).tags) acc.tags.add(t);
        continue;
      }

      if (attrs.kind === "token" && attrs.tokenContract) {
        if (isContractOnlyNode(target, opts.contracts)) continue;
        const acc = linkAcc(
          target,
          attrs.tokenContract.toLowerCase(),
          opts.graph.getNodeAttributes(target).depth,
        );
        applyEdge(acc, attrs, "out", opts.txCategoriesByHash);
        for (const t of opts.graph.getNodeAttributes(target).tags) acc.tags.add(t);
      }
    }

    for (const edge of opts.graph.inEdges(seedLower)) {
      const attrs = opts.graph.getEdgeAttributes(edge);
      const source = opts.graph.source(edge);
      if (source === seedLower) continue;

      if (attrs.kind === "tx") {
        if (isContractOnlyNode(source, opts.contracts)) continue;
        const acc = linkAcc(source, null, opts.graph.getNodeAttributes(source).depth);
        applyEdge(acc, attrs, "in", opts.txCategoriesByHash);
        for (const t of opts.graph.getNodeAttributes(source).tags) acc.tags.add(t);
        continue;
      }

      if (attrs.kind === "token" && attrs.tokenContract) {
        if (isContractOnlyNode(source, opts.contracts)) continue;
        const acc = linkAcc(
          source,
          attrs.tokenContract.toLowerCase(),
          opts.graph.getNodeAttributes(source).depth,
        );
        applyEdge(acc, attrs, "in", opts.txCategoriesByHash);
        for (const t of opts.graph.getNodeAttributes(source).tags) acc.tags.add(t);
      }
    }
  }

  for (const m of opts.calldataOfac) {
    const ofacLower = m.ofac.toLowerCase();
    const contractLower = m.contract.toLowerCase();
    const acc = accFor(byLink, ofacLower, contractLower, 1);
    acc.exposure = "calldata";
    if (m.amount_raw && !acc.hasLedgerEdge) {
      try {
        acc.tokenSentRaw += BigInt(m.amount_raw);
      } catch {
        // ignore bad amount_raw
      }
    }
    acc.txHashes.add(m.tx_hash);
    if (!acc.topTx) acc.topTx = m.tx_hash;
    acc.tags.add("ofac");
    acc.tags.add("calldata");
    for (const c of opts.txCategoriesByHash.get(m.tx_hash.toLowerCase()) ?? []) {
      acc.linkCategories.add(c);
    }
  }

  for (const acc of byLink.values()) {
    const lower = acc.peerLower;
    if (opts.xfwil.has(lower)) acc.tags.add("cex");
    if (opts.ofac.has(lower)) acc.tags.add("ofac");

    acc.exposure = betterExposure(
      acc.exposure,
      exposureForLink(lower, opts.ofac, opts.calldataOfac, acc.hasLedgerEdge),
    );
  }

  const peers: PeerSummary[] = [];
  for (const acc of byLink.values()) {
    if (acc.peerLower === seedLower) continue;
    // Drop standalone calldata contract rows — rolled into (ofac, contract) link.
    if (
      acc.contractLower === null &&
      calldataContractOfac.has(acc.peerLower) &&
      !opts.ofac.has(acc.peerLower)
    ) {
      continue;
    }
    const linked = acc.sentWei + acc.recvWei;
    peers.push({
      address: checksumNode(acc.peerLower),
      contract_address: acc.contractLower ? checksumNode(acc.contractLower) : undefined,
      depth: acc.depth,
      sent_eth: formatWeiEth(acc.sentWei),
      recv_eth: formatWeiEth(acc.recvWei),
      linked_eth: formatWeiEth(linked),
      tx_count: acc.txHashes.size,
      exposure: acc.exposure,
      tags: [...acc.tags].sort(),
      ofac_entity: opts.ofacNames.get(acc.peerLower) ?? null,
      top_tx: acc.topTx,
      token_sent: formatTokenAmount(acc.tokenSentRaw, acc.tokenDecimals),
      token_recv: formatTokenAmount(acc.tokenRecvRaw, acc.tokenDecimals),
      link_categories: [...acc.linkCategories].sort(),
    });
  }

  return peers.sort((a, b) => {
    const diff = parseEthToWei(b.linked_eth) - parseEthToWei(a.linked_eth);
    if (diff !== 0n) return diff > 0n ? 1 : -1;
    const addrCmp = a.address.localeCompare(b.address);
    if (addrCmp !== 0) return addrCmp;
    return (a.contract_address ?? "").localeCompare(b.contract_address ?? "");
  });
}

function peerPriority(p: PeerSummary): number {
  if (p.exposure === "direct") return 1_000_000;
  if (p.exposure === "calldata") return 900_000;
  if (p.tags.includes("ofac")) return 700_000;
  if (p.tags.includes("cex")) return 600_000;
  if (p.tags.includes("high_value") || p.link_categories.includes("high_value")) return 550_000;
  return Number(parseEthToWei(p.linked_eth));
}

export type SelectedPeers = {
  peers: PeerSummary[];
  truncated: boolean;
};

/** Select flagged peers for CSV/output, merged by address, capped at GRAPH.maxPeers. */
export function selectPeersForOutput(
  all: PeerSummary[],
  contracts: Map<string, string>,
): SelectedPeers {
  const merged = mergePeersByAddress(all);
  const flagged = merged.filter((p) => shouldIncludePeer(p, contracts));
  const sorted = [...flagged].sort((a, b) => {
    const prio = peerPriority(b) - peerPriority(a);
    if (prio !== 0) return prio;
    return a.address.localeCompare(b.address);
  });
  const truncated = sorted.length > GRAPH.maxPeers;
  return {
    peers: sorted.slice(0, GRAPH.maxPeers),
    truncated,
  };
}
