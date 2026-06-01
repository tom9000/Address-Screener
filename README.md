# Address Screener

Screen one Ethereum address using Etherscan for connected addresses

## Run

```bash
npm install
cp .env.example .env   # ETHERSCAN_API_KEY required; SERPER_SEARCH_API_KEY optional
npm run screen 0x2f4Ef4A3D08A727e799De2756390d620eA3a7a14
npm test
npm run ci
```

**Suggested addresses to test:**

0x08723392Ed15743cc38513C4925f5e6be5c17243 (OFAC - Lazarus Group)
0x2f4Ef4A3D08A727e799De2756390d620eA3a7a14 (OFAC Transacted With - Lazarus Group)
0xC8D94b10A60c0D405463Db2e08e386380e831192 (OFAC Transacted With - Lazarus Group)
0x0330070FD38Ec3bB94F58FA55D40368271E9e54A (OFAC - Amnokgang)
0x7B0b9F208f617de8DFc0001f037E92968535F755 (OFAC Transacted With - Armando de Jesus)
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 (Vitalik.eth)
0xbAd06a3CA84E4E2b489974d8918B5f7387e6dB8E (Transacted With Vitalik.eth)  

Example output from these addresses is included: [test-output](test-output/)

## What It Does

1. **Load known entity lists** — OFAC (from ultrasound money github CSV), smart contracts (`/data/contracts.json`), CEX (`/data/xfwil-cex.csv`)
2. **Fetch transaction list** — 200 most recent txs from Etherscan
3. **Build graph** — single hop; edges formed by: ETH transfers and decoded calldata for token transactions
4. **Build peers** — roll up graph links per counterparty; match known entities and high value txs
5. **Tag txs** — match `from`/`to` tx-list, add tags for categories column
6. **Web search** — Serper lookup on seed, OFAC-listed, and high-value addresses; returns 1st page result count
7. **Write output** — timestamped `.csv` + `.json`

#### Steps of the screener are sequenced in: [/src/sequence.ts](/src/sequence.ts)

## Output

**CSV** Row: `address`, `eth_balance`, `categories`, `peer_txs`, `search` 

- Source address and ETH balance columns
- Any matches are tagged as categories
- **peer_txs**: peers as a readable list, with named entities, transaction counts and totals. e.g. `ofac:(LAZARUS GROUP):0x… txs:21 sc:unknown:0x… token_sent:8144`, `cex:bitso:0x… eth_recv:0.024 …`
- **search**: `search:<address> results:N` per address for any results on the first results page

**JSON**: structured data: `txs[]`, `peers[]`, `calldata_ofac[]`, `addresses[]`, `graph` meta.

## Config `/src/config.ts`


| Setting             | Default                                       |
| ------------------- | --------------------------------------------- |
| `TXLIST_OFFSET`     | 200                                           |
| `HIGH_VALUE_ETH`    | 1.0                                           |
| `GRAPH.maxPeers`    | 200 (cap peer rows in output)                 |
| `SEARCH_ENABLED`    | `true` — search seed, OFAC-listed, high-value |
| `MAX_SEARCH_PROBES` | 30                                            |


## TODO

- **Expand the graph to a 2nd hop**: add 2nd-order tx lists, limited around the time of the linked transaction
- **Add more OSINT**: Get ENS from RPC; scan marketplaces (eg OpenSea usernames, profile bios, etc.)
- **Expand web search**: include all (non dust) addresses, requires bigger budget for search API
- **Add high_value category to token transfers** with token/usd value, not just value in ETH
- **Add more token contracts**: currently only USDT and USDC
- **Add a dust filter** with options
- **Replace xfwil CEX list** (old community gist) with a fresher source
- **Add a local indexer** e.g. [chifra](https://github.com/TrueBlocks/trueblocks-chifra) (TrueBlocks) for cached on-chain search
- **Add more tests**
  - Integration tests gated on `ETHERSCAN_API_KEY` using wallets in `/test-output/test-addresses.md`
  - Snapshot tests for full peer strings from recorded JSON fixtures

