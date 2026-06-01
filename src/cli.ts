import "dotenv/config";
import { writeFileSync } from "node:fs";
import { getAddress, isAddress } from "viem";
import { runScreen } from "./sequence.js";
import { outputToCsv } from "./csv.js";
import { toJsonOutput } from "./json-output.js";
import { logNetworkSummary } from "./net/log.js";
import { activeSearchProvider, searchApiKeyFromEnv } from "./intel/web-search.js";

function log(msg: string): void {
  console.error(`[screen] ${msg}`);
}

function timestampForFile(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "-",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("");
}

function outputBaseName(address: `0x${string}`, date = new Date()): string {
  return `${timestampForFile(date)}-${address.slice(0, 8)}`;
}

async function main(): Promise<void> {
  const raw = process.argv.slice(2).find((arg) => isAddress(arg, { strict: false }));
  if (!raw) {
    console.error("Usage: npm run screen <0xAddress>");
    process.exit(1);
  }

  const seed = getAddress(raw);
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    console.error("Set ETHERSCAN_API_KEY in .env");
    process.exit(1);
  }

  log(`screening ${seed}`);

  const searchProvider = activeSearchProvider();
  const searchKey = searchApiKeyFromEnv(process.env);
  if (searchProvider && !searchKey) {
    log(`search provider=${searchProvider} but no API key in .env — skipping search`);
  }

  const output = await runScreen({
    seed,
    apiKey,
    searchKey,
  });

  log(
    `done: txs=${output.txs.length} addresses=${output.addresses.length} ofac_addrs=${output.addresses.filter((a) => a.categories.includes("ofac")).length}`,
  );

  const base = outputBaseName(seed);
  writeFileSync(`${base}.json`, `${JSON.stringify(toJsonOutput(output), null, 2)}\n`, "utf8");
  writeFileSync(`${base}.csv`, `${outputToCsv(output)}\n`, "utf8");
  log(`saved ${base}.json and ${base}.csv`);
  logNetworkSummary();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
