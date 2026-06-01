import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

type ContractEntry = { label: string; address: string };

/** Known smart contracts and tokens: lowercase address → label (e.g. usdt, uniswap_v2_router). */
export function loadContractRegistry(): Map<string, string> {
  const raw = JSON.parse(
    readFileSync(join(root, "data", "contracts.json"), "utf8"),
  ) as { contracts: ContractEntry[] };
  const map = new Map<string, string>();
  for (const c of raw.contracts) {
    map.set(c.address.toLowerCase(), c.label);
  }
  return map;
}

/** xfwil CEX list: lowercase address → cex_name (e.g. Binance, Bitcasino). */
export function loadXfwilRegistry(): Map<string, string> {
  const text = readFileSync(join(root, "data", "xfwil-cex.csv"), "utf8");
  const map = new Map<string, string>();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const comma = line.indexOf(",");
    if (comma < 0) continue;
    const address = line.slice(0, comma).trim().toLowerCase();
    const rest = line.slice(comma + 1);
    const comma2 = rest.indexOf(",");
    const cexName = (comma2 < 0 ? rest : rest.slice(0, comma2)).trim();
    if (address.startsWith("0x") && cexName) map.set(address, cexName);
  }
  return map;
}
