import { ETHERSCAN_FETCH_TIMEOUT_MS } from "../config.js";

const DEFAULT_TIMEOUT_MS = ETHERSCAN_FETCH_TIMEOUT_MS;

export async function fetchWithBudget(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
