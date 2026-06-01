import { sanitizeUrl, truncateDetail } from "./sanitize.js";

export type NetworkLogEntry = {
  step: string;
  service: "etherscan" | "rpc" | "brave" | "serper" | "local";
  method: string;
  url?: string;
  ms: number;
  ok: boolean;
  detail?: string;
};

const entries: NetworkLogEntry[] = [];

export function logNetwork(entry: NetworkLogEntry): void {
  entries.push(entry);
  const status = entry.ok ? "ok" : "fail";
  const urlPart = entry.url ? ` ${sanitizeUrl(entry.url)}` : "";
  const detailPart = entry.detail
    ? ` | ${entry.ok ? entry.detail : truncateDetail(entry.detail)}`
    : "";
  console.error(
    `[net] ${entry.step} | ${entry.service}.${entry.method}${urlPart} | ${entry.ms}ms | ${status}${detailPart}`,
  );
}

export async function timedNetwork<T>(
  meta: Omit<NetworkLogEntry, "ms" | "ok" | "detail"> & { detail?: string },
  fn: () => Promise<T>,
  onError?: (err: unknown) => string,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logNetwork({
      ...meta,
      ms: Date.now() - start,
      ok: true,
      detail: meta.detail,
    });
    return result;
  } catch (err) {
    logNetwork({
      ...meta,
      ms: Date.now() - start,
      ok: false,
      detail: onError?.(err) ?? (err instanceof Error ? err.message : String(err)),
    });
    throw err;
  }
}

export function logNetworkSummary(): void {
  const total = entries.length;
  const ok = entries.filter((e) => e.ok).length;
  const ms = entries.reduce((sum, e) => sum + e.ms, 0);
  console.error(`[net] summary: ${ok}/${total} calls ok, ${ms}ms total wall time (calls may overlap)`);
}
