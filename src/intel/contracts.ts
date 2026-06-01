import type { EtherscanTokenTx, EtherscanTx } from "../types.js";

const ZERO = "0x" + "0".repeat(40);

function hasCalldata(input: string | undefined): boolean {
  const trimmed = input?.trim();
  return !!trimmed && trimmed !== "0x" && trimmed.length > 2;
}

function markContract(out: Map<string, boolean>, addr: string | undefined): void {
  if (!addr) return;
  const lower = addr.toLowerCase();
  if (!lower || lower === ZERO) return;
  out.set(lower, true);
}

/**
 * Infer contract addresses from in-memory Etherscan data + registry.
 *
 * - Known registry entries (DeFi, USDC, USDT, …)
 * - `to` on any tx with non-empty calldata (call target)
 * - `contractAddress` on txlist rows (deployments) or tokentx rows (token contracts)
 *
 * Unmarked addresses are treated as EOAs.
 */
export function buildContractCache(
  txs: EtherscanTx[],
  tokenTxs: EtherscanTokenTx[],
  knownContracts: Map<string, string>,
): Map<string, boolean> {
  const out = new Map<string, boolean>();

  for (const addr of knownContracts.keys()) {
    out.set(addr, true);
  }

  for (const tx of txs) {
    if (hasCalldata(tx.input)) markContract(out, tx.to);
    markContract(out, tx.contractAddress);
  }

  for (const row of tokenTxs) {
    markContract(out, row.contractAddress);
  }

  return out;
}
