import { getAddress } from "viem";
import {
  MAX_SEARCH_PROBES,
  SEARCH_THROTTLE_MS,
} from "../config.js";
import { searchAddress } from "./web-search.js";
import type { AddressRow, SearchRecord } from "../types.js";

export type EnrichScope = {
  seed: string;
  ofacHitAddrs: Set<string>;
  highValueEndpoints: Set<string>;
};

/** Seed, OFAC-listed, and high-value endpoints — union for web search. */
export function resolveSearchTargets(scope: EnrichScope): Set<string> {
  const out = new Set<string>();
  out.add(scope.seed.toLowerCase());
  for (const a of scope.ofacHitAddrs) out.add(a);
  for (const a of scope.highValueEndpoints) out.add(a);
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function probePriority(categories: string[]): number {
  if (categories.includes("ofac")) return 1_000;
  if (categories.includes("high_value")) return 100;
  return 0;
}

export async function enrichAddresses(opts: {
  scope: EnrichScope;
  searchEnabled: boolean;
  categoriesByAddr: Map<string, string[]>;
  ofacNames: Map<string, string>;
  searchKey: string | undefined;
}): Promise<AddressRow[]> {
  const searchTargets = opts.searchEnabled
    ? resolveSearchTargets(opts.scope)
    : new Set<string>();
  const sorted = [...searchTargets].sort((a, b) => {
    const ca = opts.categoriesByAddr.get(a.toLowerCase()) ?? [];
    const cb = opts.categoriesByAddr.get(b.toLowerCase()) ?? [];
    return probePriority(cb) - probePriority(ca);
  });

  const searchByAddr = new Map<string, SearchRecord>();
  if (opts.searchKey) {
    let probes = 0;
    for (let i = 0; i < sorted.length && probes < MAX_SEARCH_PROBES; i++) {
      probes++;
      const addr = getAddress(sorted[i]!);
      searchByAddr.set(
        addr.toLowerCase(),
        await searchAddress(addr, opts.searchKey, `4_search_${probes}`),
      );
      if (probes < MAX_SEARCH_PROBES && i < sorted.length - 1) {
        await sleep(SEARCH_THROTTLE_MS);
      }
    }
  }

  return sorted.map((raw) => {
    const lower = raw.toLowerCase();
    const categories = [...(opts.categoriesByAddr.get(lower) ?? [])];
    const search = searchByAddr.get(lower) ?? null;
    return {
      address: getAddress(raw),
      categories,
      ofac_entity: opts.ofacNames.get(lower) ?? null,
      search,
    };
  });
}
