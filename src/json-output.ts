import type { ScreenOutput, TxRow } from "./types.js";

type TxJson = Omit<
  TxRow,
  "gas" | "gasPrice" | "cumulativeGasUsed" | "gasUsed" | "confirmations"
>;

export type ScreenJsonOutput = Omit<ScreenOutput, "txs"> & { txs: TxJson[] };

function stripTxGasFields(tx: TxRow): TxJson {
  const { gas: _g, gasPrice: _gp, cumulativeGasUsed: _c, gasUsed: _gu, confirmations: _n, ...rest } =
    tx;
  return rest;
}

/** Screen output with gas/confirmation fields removed from txs for JSON export. */
export function toJsonOutput(output: ScreenOutput): ScreenJsonOutput {
  return {
    ...output,
    txs: output.txs.map(stripTxGasFields),
  };
}
