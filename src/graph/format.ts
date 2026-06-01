import { getAddress } from "viem";
import type { EtherscanTx, PeerSummary, PeerTokenLink } from "../types.js";

const ZERO = "0x" + "0".repeat(40);

function endpoints(tx: EtherscanTx): string[] {
  return [tx.from, tx.to].filter((a) => a && a.toLowerCase() !== ZERO);
}

/** True if seed or any tx endpoint matches the xfwil CEX registry. */
export function hasAnyXfwilMatch(
  seed: string,
  txs: EtherscanTx[],
  xfwil: Map<string, string>,
): boolean {
  const seedLower = seed.toLowerCase();
  if (xfwil.has(seedLower)) return true;
  for (const tx of txs) {
    for (const addr of endpoints(tx)) {
      if (xfwil.has(addr.toLowerCase())) return true;
    }
  }
  return false;
}

function ofacNameLabel(name: string | null | undefined): string {
  if (!name?.trim()) return "";
  return `(${name.trim().replace(/,/g, ";")})`;
}

function isOfacListedAddress(
  lower: string,
  ofac: Set<string>,
  ofacEntity: string | null | undefined,
): boolean {
  return ofac.has(lower) || !!ofacEntity?.trim();
}

function ofacListedPrefix(addr: string, ofacEntity: string | null | undefined): string {
  const label = ofacNameLabel(ofacEntity);
  return label ? `ofac:${label}:${addr}` : `ofac:${addr}`;
}

/** Seed row when the screened wallet is on the OFAC list. */
export function formatSeedOfacEntry(seed: string, ofacNames: Map<string, string>): string {
  return ofacListedPrefix(getAddress(seed), ofacNames.get(seed.toLowerCase()) ?? null);
}

export type FormatPeersCsvOpts = {
  seed: string;
  ofac: Set<string>;
  ofacNames: Map<string, string>;
};

/** Counterparty prefix only (no sc: — token contracts follow eth volumes). */
function peerPrefix(
  p: PeerSummary,
  xfwil: Map<string, string>,
  opts: FormatPeersCsvOpts,
): string {
  const addr = p.address;
  const lower = addr.toLowerCase();
  const seedOnOfac = opts.ofac.has(opts.seed.toLowerCase());
  const peerListed = isOfacListedAddress(lower, opts.ofac, p.ofac_entity);

  if (peerListed) {
    return ofacListedPrefix(addr, p.ofac_entity ?? opts.ofacNames.get(lower) ?? null);
  }

  if (seedOnOfac && p.tags.includes("ofac")) {
    return `ofac_peer:${addr}`;
  }

  if (p.tags.includes("ofac")) {
    return ofacListedPrefix(addr, p.ofac_entity);
  }

  const cexName = xfwil.get(lower);
  if (cexName) return `cex:${cexName.toLowerCase()}:${addr}`;
  if (p.tags.includes("high_value") || p.link_categories.includes("high_value")) {
    return `high_value:${addr}`;
  }
  if (p.exposure === "direct") return `direct:${addr}`;
  return `peer:${addr}`;
}

function formatTokenLinkParts(
  link: PeerTokenLink,
  contracts: Map<string, string>,
): string[] {
  const parts: string[] = [];
  const scLabel = contracts.get(link.contract_address.toLowerCase()) ?? "unknown";
  parts.push(`sc:${scLabel}:${getAddress(link.contract_address)}`);
  if (link.token_sent) parts.push(`token_sent:${link.token_sent}`);
  if (link.token_recv) parts.push(`token_recv:${link.token_recv}`);
  return parts;
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

/** One pipe-separated peers column entry. */
function formatPeerCsvEntry(
  p: PeerSummary,
  xfwil: Map<string, string>,
  contracts: Map<string, string>,
  opts: FormatPeersCsvOpts,
): string {
  const parts = [
    peerPrefix(p, xfwil, opts),
    `txs:${p.tx_count}`,
    `eth_sent:${p.sent_eth}`,
    `eth_recv:${p.recv_eth}`,
  ];

  for (const link of peerTokenLinks(p)) {
    parts.push(...formatTokenLinkParts(link, contracts));
  }

  return parts.join(" ");
}

export function formatPeersCsv(
  peers: PeerSummary[],
  xfwil: Map<string, string>,
  contracts: Map<string, string>,
  opts: FormatPeersCsvOpts,
): string[] {
  const entries = peers.map((p) => formatPeerCsvEntry(p, xfwil, contracts, opts));
  if (!opts.ofac.has(opts.seed.toLowerCase())) return entries;
  return [formatSeedOfacEntry(opts.seed, opts.ofacNames), ...entries];
}
