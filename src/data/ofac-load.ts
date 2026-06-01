import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

export const OFAC_CSV_URL =
  "https://raw.githubusercontent.com/ultrasoundmoney/ofac-ethereum-addresses/main/data.csv";

export type OfacList = {
  set: Set<string>;
  names: Map<string, string>;
  source: "ultrasound_csv" | "bundled_csv" | "bundled_json";
};

/** Parse ultrasound `data.csv` (columns: address,name). */
export function parseOfacCsv(csv: string): OfacList {
  const set = new Set<string>();
  const names = new Map<string, string>();
  const lines = csv.trim().split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const comma = line.indexOf(",");
    if (comma < 0) continue;
    const address = line.slice(0, comma).trim().toLowerCase();
    let name = line.slice(comma + 1).trim();
    if (name.startsWith('"') && name.endsWith('"')) {
      name = name.slice(1, -1).replace(/""/g, '"');
    }
    if (!address.startsWith("0x")) continue;
    set.add(address);
    if (name) names.set(address, name);
  }
  return { set, names, source: "ultrasound_csv" };
}

function loadOfacFromBundledCsv(): OfacList | null {
  try {
    const csv = readFileSync(join(root, "data", "ofac-eth.csv"), "utf8");
    const parsed = parseOfacCsv(csv);
    if (parsed.set.size === 0) return null;
    return { ...parsed, source: "bundled_csv" };
  } catch {
    return null;
  }
}

function loadOfacFromBundledJson(): OfacList {
  const raw = JSON.parse(readFileSync(join(root, "data", "ofac-eth.json"), "utf8")) as {
    addresses?: string[];
    labels?: { address: string; name: string }[];
  };
  const set = new Set<string>();
  const names = new Map<string, string>();
  for (const addr of raw.addresses ?? []) {
    set.add(addr.toLowerCase());
  }
  for (const row of raw.labels ?? []) {
    const lower = row.address.toLowerCase();
    set.add(lower);
    if (row.name) names.set(lower, row.name);
  }
  return { set, names, source: "bundled_json" };
}

/** Live OFAC list from ultrasound CSV; bundled CSV/JSON if fetch fails. */
export async function loadOfacList(): Promise<OfacList> {
  try {
    const res = await fetch(OFAC_CSV_URL, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const parsed = parseOfacCsv(csv);
    if (parsed.set.size === 0) throw new Error("empty OFAC CSV");
    return parsed;
  } catch {
    return loadOfacFromBundledCsv() ?? loadOfacFromBundledJson();
  }
}
