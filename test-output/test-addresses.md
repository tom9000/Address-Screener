# Test Addresses

Manual regression set for `npm run screen`. Reference outputs in this folder (`20260601-*-<prefix>.{csv,json}`).

```bash
npm run screen <address>
```


| Seed                                         | Scenario                                | categories                   | peer_txs highlights                                                                                                       |
| -------------------------------------------- | --------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `0x7B0b9F208f617de8DFc0001f037E92968535F755` | Calldata OFAC + CEX                     | `ofac cex search`            | `ofac:(OJEDA AVILES; …):0x038989…` + `sc:usdt:… token_sent:8144`; merged `cex:bitso:… txs:4` + USDT recv; `cex:binance:…` |
| `0x2f4Ef4A3D08A727e799De2756390d620eA3a7a14` | Lazarus calldata + CEX + high value     | `ofac cex high_value search` | `ofac:(LAZARUS GROUP):0x087233… sc:unknown:0xadE482…`; `cex:fixedfloat:…`; `high_value:… eth_sent:2.46`                   |
| `0x0330070FD38Ec3bB94F58FA55D40368271E9e54A` | OFAC-listed seed                        | `ofac cex search`            | seed row `ofac:(AMNOKGANG …):0x033007…`; counterparties `ofac_peer:…`; `cex:binance:…` + USDC/USDT sends                  |
| `0x08723392Ed15743cc38513C4925f5e6be5c17243` | OFAC hub (Lazarus)                      | `ofac high_value search`     | many `ofac:(LAZARUS GROUP):…` / `ofac:…` peers; large `eth_recv` / `eth_sent` on listed addrs                             |
| `0xC8D94b10A60c0D405463Db2e08e386380e831192` | OFAC transacted with (Lazarus calldata) | `ofac cex search`            | `ofac:(LAZARUS GROUP):0x098B716…` via `sc:unknown:0xd15fE…`; `cex:binance:…`; `peer:0xd15fE…` + large `token_sent`        |
| `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` | Clean whale (vitalik.eth)               | `high_value search`          | no `ofac`; `high_value:… eth_sent:160` / `eth_sent:64`                                                                    |
| `0xbAd06a3CA84E4E2b489974d8918B5f7387e6dB8E` | Transacted with Vitalik                 | `high_value cex search`      | `high_value:0xd8dA6B… eth_recv:64`; `cex:fixedfloat:…`; no `ofac`                                                         |


## Quick copy

```
0x7B0b9F208f617de8DFc0001f037E92968535F755
0x2f4Ef4A3D08A727e799De2756390d620eA3a7a14
0x0330070FD38Ec3bB94F58FA55D40368271E9e54A
0x08723392Ed15743cc38513C4925f5e6be5c17243
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
0xC8D94b10A60c0D405463Db2e08e386380e831192
0xbAd06a3CA84E4E2b489974d8918B5f7387e6dB8E
```

