import { describe, expect, it } from "vitest";
import { toJsonOutput } from "./json-output.js";
import { minimalScreenOutput, tx } from "./test/fixtures.js";

describe("toJsonOutput", () => {
  it("strips gas-related fields from txs", () => {
    const out = toJsonOutput(
      minimalScreenOutput({
        txs: [tx({ hash: "0x" + "c".repeat(64) })],
      }),
    );
    const row = out.txs[0]!;
    expect(row).not.toHaveProperty("gas");
    expect(row).not.toHaveProperty("gasPrice");
    expect(row).not.toHaveProperty("gasUsed");
    expect(row).not.toHaveProperty("cumulativeGasUsed");
    expect(row).not.toHaveProperty("confirmations");
    expect(row.hash).toBe("0x" + "c".repeat(64));
  });
});
