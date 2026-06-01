import { z } from "zod";
import { ETHERSCAN_FETCH_TIMEOUT_MS, TXLIST_OFFSET } from "../config.js";
import { loggedFetch } from "../net/http.js";
import type { EtherscanTokenTx, EtherscanTx } from "../types.js";

const txSchema = z.object({
  blockNumber: z.string(),
  timeStamp: z.string(),
  hash: z.string(),
  nonce: z.string(),
  blockHash: z.string(),
  transactionIndex: z.string(),
  from: z.string(),
  to: z.string(),
  value: z.string(),
  gas: z.string(),
  gasPrice: z.string(),
  isError: z.string(),
  txreceipt_status: z.string(),
  input: z.string(),
  contractAddress: z.string(),
  cumulativeGasUsed: z.string(),
  gasUsed: z.string(),
  confirmations: z.string(),
  methodId: z.string(),
  functionName: z.string(),
});

const responseSchema = z.object({
  status: z.string(),
  message: z.string(),
  result: z.union([z.array(txSchema), z.string()]),
});

const CHAIN_ID = "1";

export async function getBalanceWei(address: string, apiKey: string): Promise<bigint> {
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", CHAIN_ID);
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "balance");
  url.searchParams.set("address", address);
  url.searchParams.set("tag", "latest");
  url.searchParams.set("apikey", apiKey);

  const res = await loggedFetch(
    "1a_balance",
    "etherscan",
    "account.balance",
    url.toString(),
    undefined,
    ETHERSCAN_FETCH_TIMEOUT_MS,
  );
  const json = z.object({ result: z.string() }).parse(await res.json());
  return BigInt(json.result);
}

export async function getTxList(
  address: string,
  apiKey: string,
  opts?: { offset?: number; step?: string },
): Promise<EtherscanTx[]> {
  const offset = opts?.offset ?? TXLIST_OFFSET;
  const step = opts?.step ?? "1_txlist";
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", CHAIN_ID);
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "txlist");
  url.searchParams.set("address", address);
  url.searchParams.set("startblock", "0");
  url.searchParams.set("endblock", "99999999");
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("sort", "desc");
  url.searchParams.set("apikey", apiKey);

  const res = await loggedFetch(
    step,
    "etherscan",
    "account.txlist",
    url.toString(),
    undefined,
    ETHERSCAN_FETCH_TIMEOUT_MS,
  );
  const json = responseSchema.parse(await res.json());
  if (json.status !== "1" || typeof json.result === "string") {
    return [];
  }
  return json.result as EtherscanTx[];
}

const tokenTxSchema = z.object({
  hash: z.string(),
  from: z.string(),
  to: z.string(),
  value: z.string(),
  contractAddress: z.string(),
  tokenSymbol: z.string(),
  tokenDecimal: z.string(),
});

const tokenResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  result: z.union([z.array(tokenTxSchema), z.string()]),
});

/** ERC-20 transfers for seed (same window size as txlist). */
export async function getTokenTransfers(
  address: string,
  apiKey: string,
  opts?: { offset?: number; step?: string },
): Promise<EtherscanTokenTx[]> {
  const offset = opts?.offset ?? TXLIST_OFFSET;
  const step = opts?.step ?? "1b_tokentx";
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", CHAIN_ID);
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "tokentx");
  url.searchParams.set("address", address);
  url.searchParams.set("startblock", "0");
  url.searchParams.set("endblock", "99999999");
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("sort", "desc");
  url.searchParams.set("apikey", apiKey);

  const res = await loggedFetch(
    step,
    "etherscan",
    "account.tokentx",
    url.toString(),
    undefined,
    ETHERSCAN_FETCH_TIMEOUT_MS,
  );
  const json = tokenResponseSchema.parse(await res.json());
  if (json.status !== "1" || typeof json.result === "string") {
    return [];
  }
  return json.result as EtherscanTokenTx[];
}

const rawTxSchema = z.object({
  from: z.string(),
  to: z.string(),
  value: z.string(),
  input: z.string(),
});

const rawTxResponseSchema = z.object({
  result: rawTxSchema.nullable(),
});

export type RawTx = z.infer<typeof rawTxSchema>;

export async function getTransactionByHash(
  hash: string,
  apiKey: string,
  step = "finder_tx",
): Promise<RawTx | null> {
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", CHAIN_ID);
  url.searchParams.set("module", "proxy");
  url.searchParams.set("action", "eth_getTransactionByHash");
  url.searchParams.set("txhash", hash);
  url.searchParams.set("apikey", apiKey);

  try {
    const res = await loggedFetch(
      step,
      "etherscan",
      "proxy.eth_getTransactionByHash",
      url.toString(),
      undefined,
      ETHERSCAN_FETCH_TIMEOUT_MS,
    );
    const json = rawTxResponseSchema.parse(await res.json());
    return json.result;
  } catch {
    return null;
  }
}
