import { describe, expect, it } from "vitest";
import { selectPeersForOutput } from "./aggregate.js";
import { peer } from "../test/fixtures.js";

const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const BITSO = "0x29D5527CaA78f1946a409FA6aCaf14A0a4A0274b";
const contracts = new Map([["0xdac17f958d2ee523a2206206994597c13d831ec7", "usdt"]]);

describe("selectPeersForOutput", () => {
  it("merges native and token links for the same counterparty", () => {
    const links = [
      peer({
        address: BITSO,
        tx_count: 2,
        recv_eth: "0.02428173",
        tags: ["cex"],
        link_categories: ["cex"],
      }),
      peer({
        address: BITSO,
        contract_address: USDT,
        tx_count: 2,
        token_recv: "8144.32",
        tags: ["cex", "sc:usdt"],
        link_categories: ["sc:usdt"],
      }),
    ];

    const { peers } = selectPeersForOutput(links, contracts);
    expect(peers).toHaveLength(1);
    expect(peers[0]!.tx_count).toBe(4);
    expect(peers[0]!.recv_eth).toBe("0.02428173");
    expect(peers[0]!.token_links).toEqual([
      { contract_address: USDT, token_recv: "8144.32" },
    ]);
  });

  it("excludes unflagged peers without output categories", () => {
    const { peers } = selectPeersForOutput(
      [
        peer({
          address: "0x" + "4".repeat(40),
          tags: [],
          link_categories: [],
        }),
      ],
      contracts,
    );
    expect(peers).toHaveLength(0);
  });
});
