import { fetchWithBudget } from "../budget/fetch.js";
import { timedNetwork } from "./log.js";

export async function loggedFetch(
  step: string,
  service: "etherscan" | "brave" | "serper",
  method: string,
  url: string,
  init?: RequestInit,
  timeoutMs?: number,
): Promise<Response> {
  return timedNetwork(
    { step, service, method, url },
    () => fetchWithBudget(url, init, timeoutMs),
    (err) => (err instanceof Error ? err.message : String(err)),
  );
}
