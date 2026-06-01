import { describe, expect, it } from "vitest";
import { formatPeersCsv, formatSeedOfacEntry, hasAnyXfwilMatch } from "./format.js";
import { peer, tx } from "../test/fixtures.js";

const SEED = "0x0330070FD38Ec3bB94F58FA55D40368271E9e54A";
const SEED_LOWER = SEED.toLowerCase();
const PEER = "0x37a1C1ea4dE0EFE02cfC4DE510F731e928850114";
const OFAC_HIT = "0x038989cBB1710C72b9920Dc4Fa529158f463e72c";
const BITSO = "0x29D5527CaA78f1946a409FA6aCaf14A0a4A0274b";
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

const contracts = new Map([["0xdac17f958d2ee523a2206206994597c13d831ec7", "usdt"]]);
const xfwil = new Map([[BITSO.toLowerCase(), "bitso"]]);

describe("formatSeedOfacEntry", () => {
  it("includes entity name in parentheses", () => {
    const names = new Map([[SEED_LOWER, "AMNOKGANG TECHNOLOGY DEVELOPMENT COMPANY"]]);
    expect(formatSeedOfacEntry(SEED, names)).toBe(
      `ofac:(AMNOKGANG TECHNOLOGY DEVELOPMENT COMPANY):${SEED}`,
    );
  });
});

describe("formatPeersCsv", () => {
  const ofacNames = new Map([
    [SEED_LOWER, "AMNOKGANG TECHNOLOGY DEVELOPMENT COMPANY"],
    [OFAC_HIT.toLowerCase(), "OJEDA AVILES, Armando de Jesus"],
  ]);

  it("prepends seed row when seed is OFAC-listed", () => {
    const ofac = new Set([SEED_LOWER]);
    const peers = [
      peer({
        address: PEER,
        recv_eth: "0.096353409478703436",
        tags: ["ofac"],
        link_categories: ["ofac"],
      }),
    ];
    const rows = formatPeersCsv(peers, xfwil, contracts, { seed: SEED, ofac, ofacNames });
    expect(rows[0]).toBe(`ofac:(AMNOKGANG TECHNOLOGY DEVELOPMENT COMPANY):${SEED}`);
    expect(rows[1]).toMatch(/^ofac_peer:0x37a1C1/);
  });

  it("uses ofac:(name):addr for listed OFAC counterparty when seed is not listed", () => {
    const seed = "0x7B0b9F208f617de8DFc0001f037E92968535F755";
    const ofac = new Set([OFAC_HIT.toLowerCase()]);
    const peers = [
      peer({
        address: OFAC_HIT,
        tags: ["ofac", "calldata"],
        ofac_entity: "OJEDA AVILES, Armando de Jesus",
        token_links: [{ contract_address: USDT, token_sent: "8144" }],
        link_categories: ["ofac", "sc:usdt"],
      }),
    ];
    const rows = formatPeersCsv(peers, xfwil, contracts, { seed, ofac, ofacNames });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("ofac:(OJEDA AVILES; Armando de Jesus):");
    expect(rows[0]).toContain("sc:usdt:");
    expect(rows[0]).toContain("token_sent:8144");
  });

  it("merges cex and token parts on one row", () => {
    const ofac = new Set<string>();
    const seed = "0x7B0b9F208f617de8DFc0001f037E92968535F755";
    const peers = [
      peer({
        address: BITSO,
        tx_count: 4,
        recv_eth: "0.02428173",
        tags: ["cex"],
        token_links: [{ contract_address: USDT, token_recv: "8144.32" }],
        link_categories: ["cex", "sc:usdt"],
      }),
    ];
    const rows = formatPeersCsv(peers, xfwil, contracts, { seed, ofac, ofacNames });
    expect(rows[0]).toMatch(/^cex:bitso:/);
    expect(rows[0]).toContain("txs:4");
    expect(rows[0]).toContain("token_recv:8144.32");
  });

  it("uses high_value prefix", () => {
    const rows = formatPeersCsv(
      [
        peer({
          address: "0xb99E1845a69065659DeBC8D8DD10b8DFEcc6E4ed",
          sent_eth: "2.461791914389637946",
          tags: ["high_value"],
          link_categories: ["high_value"],
        }),
      ],
      new Map(),
      contracts,
      { seed: "0x2f4Ef4A3D08A727e799De2756390d620eA3a7a14", ofac: new Set(), ofacNames },
    );
    expect(rows[0]).toMatch(/^high_value:0xb99E/);
  });
});

describe("hasAnyXfwilMatch", () => {
  it("returns true when a tx endpoint is in xfwil", () => {
    const match = hasAnyXfwilMatch(
      "0x" + "9".repeat(40),
      [tx({ from: BITSO, to: "0x" + "9".repeat(40) })],
      xfwil,
    );
    expect(match).toBe(true);
  });
});
