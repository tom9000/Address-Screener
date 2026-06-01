import { decodeFunctionData, formatUnits, getAddress } from "viem";
import { STABLECOIN_DECIMALS } from "../config.js";
import type { CalldataOfacMatch, EtherscanTx } from "../types.js";
import { extractCalldataAddresses } from "./calldata.js";

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const STABLE_LABELS = new Set(["usdt", "usdc"]);

type DecodedTokenTransfer = {
  fn: "transfer" | "transferFrom";
  to: string;
  from?: string;
  amount: bigint;
  selector: string;
};

function tokenDecimals(label: string | undefined): number {
  if (label && STABLE_LABELS.has(label)) return STABLECOIN_DECIMALS;
  return 18;
}

function selectorHex(input: string): string | undefined {
  const hex = input.startsWith("0x") ? input.slice(2) : input;
  if (hex.length < 8) return undefined;
  return ("0x" + hex.slice(0, 8)).toLowerCase();
}

function formatAmount(amount: bigint, decimals: number): string {
  const s = formatUnits(amount, decimals);
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

/** Decode ERC-20 transfer / transferFrom calldata; null if selector or layout doesn't match. */
function decodeErc20Transfer(input: string): DecodedTokenTransfer | null {
  try {
    const decoded = decodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      data: input as `0x${string}`,
    });
    const sel = selectorHex(input);
    if (!sel) return null;

    if (decoded.functionName === "transfer") {
      const [to, amount] = decoded.args as [string, bigint];
      return { fn: "transfer", to: getAddress(to), amount, selector: sel };
    }
    if (decoded.functionName === "transferFrom") {
      const [from, to, amount] = decoded.args as [string, string, bigint];
      return {
        fn: "transferFrom",
        from: getAddress(from),
        to: getAddress(to),
        amount,
        selector: sel,
      };
    }
  } catch {
    // not ERC-20 transfer*
  }
  return null;
}

function matchFromDecoded(
  tx: EtherscanTx,
  decoded: DecodedTokenTransfer,
  ofac: Set<string>,
  contracts: Map<string, string>,
): CalldataOfacMatch[] {
  const contract = getAddress(tx.to);
  const tokenLabel = contracts.get(tx.to.toLowerCase());
  const decimals = tokenDecimals(tokenLabel);
  const amountStr = formatAmount(decoded.amount, decimals);
  const amountRaw = decoded.amount.toString();
  const hits: CalldataOfacMatch[] = [];

  const candidates = [decoded.to, decoded.from].filter(Boolean) as string[];
  for (const addr of candidates) {
    if (!ofac.has(addr.toLowerCase())) continue;
    hits.push({
      contract,
      ofac: getAddress(addr),
      tx_hash: tx.hash,
      selector: decoded.selector,
      token_label: tokenLabel,
      amount_raw: amountRaw,
      amount: amountStr,
      decode: decoded.fn,
    });
  }
  return hits;
}

function matchHeuristic(tx: EtherscanTx, ofac: Set<string>): CalldataOfacMatch[] {
  const contract = getAddress(tx.to);
  const hits: CalldataOfacMatch[] = [];
  for (const candidate of extractCalldataAddresses(tx.input)) {
    if (!ofac.has(candidate)) continue;
    hits.push({
      contract,
      ofac: getAddress(candidate),
      tx_hash: tx.hash,
      decode: "heuristic",
    });
  }
  return hits;
}

/** ABI decode transfer(to, amount) where possible; heuristic fallback for other calldata. */
export function scanCalldataForOfac(opts: {
  tx: EtherscanTx;
  ofac: Set<string>;
  contractCache: Map<string, boolean>;
  contracts: Map<string, string>;
}): CalldataOfacMatch[] {
  const { tx, ofac, contractCache, contracts } = opts;
  if (!contractCache.get(tx.to.toLowerCase())) return [];

  const input = tx.input?.trim();
  if (!input || input === "0x" || input.length < 10) return [];

  const decoded = decodeErc20Transfer(input);
  if (decoded) return matchFromDecoded(tx, decoded, ofac, contracts);

  return matchHeuristic(tx, ofac);
}

/** True if calldata references ofac (ABI-decoded to/from or heuristic word walk). */
export function inputReferencesOfac(input: string, ofacLower: string): boolean {
  const decoded = decodeErc20Transfer(input);
  if (decoded) {
    if (decoded.to.toLowerCase() === ofacLower) return true;
    if (decoded.from?.toLowerCase() === ofacLower) return true;
    return false;
  }
  return extractCalldataAddresses(input).includes(ofacLower);
}
