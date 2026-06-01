import { describe, expect, it } from "vitest";
import { outputToCsv } from "./csv.js";
import { minimalScreenOutput, tx } from "./test/fixtures.js";

describe("outputToCsv", () => {
  it("uses eth_balance header and ordered categories", () => {
    const csv = outputToCsv(
      minimalScreenOutput({
        seed: "0x0330070FD38Ec3bB94F58FA55D40368271E9e54A",
        has_cex: true,
        meta: { txlist_count: 4, high_value_eth: "1", ofac_source: "bundled_csv", seed_balance_eth: "0.109" },
        txs: [tx({ categories: ["ofac", "sc:usdt"] }), tx({ categories: ["high_value"] })],
        addresses: [
          {
            address: "0x0330070FD38Ec3bB94F58FA55D40368271E9e54A",
            categories: ["ofac"],
            ofac_entity: "AMNOKGANG TECHNOLOGY DEVELOPMENT COMPANY",
            search: { results: 10 },
          },
        ],
        peer_strings: ["ofac:(AMNOKGANG TECHNOLOGY DEVELOPMENT COMPANY):0x0330070FD38Ec3bB94F58FA55D40368271E9e54A"],
      }),
    );
    const [header, row] = csv.split("\n");
    expect(header).toBe("address,eth_balance,categories,peer_txs,search");
    expect(row).toContain(",ofac high_value cex search,");
    expect(row).toContain("results:10");
  });

  it("omits sc: tags from categories column", () => {
    const csv = outputToCsv(
      minimalScreenOutput({
        txs: [tx({ categories: ["sc:usdt", "cex"] })],
      }),
    );
    expect(csv).toContain(",cex,");
    expect(csv).not.toContain("sc:usdt");
  });
});
