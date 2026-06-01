import { ETHERSCAN_THROTTLE_MS } from "../config.js";

let lastEtherscanAt = 0;

export async function throttleEtherscan(ms = ETHERSCAN_THROTTLE_MS): Promise<void> {
  const wait = Math.max(0, lastEtherscanAt + ms - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastEtherscanAt = Date.now();
}
