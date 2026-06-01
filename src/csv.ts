import type { ScreenOutput } from "./types.js";
import { formatSearchCsvEntry } from "./intel/web-search.js";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function collectTags(output: ScreenOutput): string[] {
  const tags = new Set<string>();
  for (const tx of output.txs) {
    for (const c of tx.categories) tags.add(c);
  }
  for (const a of output.addresses) {
    for (const c of a.categories) tags.add(c);
  }
  return [...tags];
}

function searchPriority(categories: string[]): number {
  if (categories.includes("ofac")) return 1_000;
  if (categories.includes("high_value")) return 100;
  return 0;
}

function compareSearchRows(
  seed: string,
  a: ScreenOutput["addresses"][number],
  b: ScreenOutput["addresses"][number],
): number {
  const seedLower = seed.toLowerCase();
  const aIsSeed = a.address.toLowerCase() === seedLower;
  const bIsSeed = b.address.toLowerCase() === seedLower;
  if (aIsSeed !== bIsSeed) return aIsSeed ? -1 : 1;

  const priorityDiff = searchPriority(b.categories) - searchPriority(a.categories);
  if (priorityDiff !== 0) return priorityDiff;
  return a.address.localeCompare(b.address);
}

const CATEGORY_ORDER = ["ofac", "high_value", "cex", "search"] as const;

function sortCategoriesForCsv(categories: string[]): string[] {
  const rank = new Map(CATEGORY_ORDER.map((c, i) => [c, i]));
  return [...new Set(categories)].sort((a, b) => {
    const ra = rank.get(a as (typeof CATEGORY_ORDER)[number]) ?? 999;
    const rb = rank.get(b as (typeof CATEGORY_ORDER)[number]) ?? 999;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

/** One seed row summarising categories across txs and addresses. */
export function outputToCsv(output: ScreenOutput): string {
  const headers = ["address", "eth_balance", "categories", "peer_txs", "search"];
  const allTags = collectTags(output);
  const hasSearchHits = output.addresses.some((a) => (a.search?.results ?? 0) > 0);
  const categoryList = allTags
    .filter((c) => !c.startsWith("sc:"));
  if (output.has_cex && !categoryList.includes("cex")) categoryList.push("cex");
  if (hasSearchHits && !categoryList.includes("search")) categoryList.push("search");
  const categories = sortCategoriesForCsv(categoryList).join(" ");
  const peers = output.peer_strings.join(" | ");

  const searchParts = output.addresses
    .filter((a) => a.search)
    .sort((a, b) => compareSearchRows(output.seed, a, b))
    .map((a) => formatSearchCsvEntry(a.address, a.search!));

  const row = [
    output.seed,
    output.meta.seed_balance_eth ?? "",
    categories,
    peers,
    searchParts.join(" | "),
  ];
  return [headers.map(escapeCsv).join(","), row.map(escapeCsv).join(",")].join("\n");
}
