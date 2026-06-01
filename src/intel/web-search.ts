import { z } from "zod";
import { SEARCH, SEARCH_FETCH_TIMEOUT_MS, type SearchProvider } from "../config.js";
import { loggedFetch } from "../net/http.js";
import type { SearchRecord } from "../types.js";

const braveResponseSchema = z.object({
  web: z
    .object({
      results: z.array(z.unknown()).optional(),
    })
    .optional(),
});

const serperResponseSchema = z.object({
  organic: z.array(z.unknown()).optional(),
});

export function activeSearchProvider(): SearchProvider | null {
  for (const [name, cfg] of Object.entries(SEARCH)) {
    if (cfg.enabled) return name as SearchProvider;
  }
  return null;
}

export function searchApiKeyFromEnv(env: {
  SERPER_SEARCH_API_KEY?: string;
  BRAVE_SEARCH_API_KEY?: string;
}): string | undefined {
  const provider = activeSearchProvider();
  if (provider === "serper") return env.SERPER_SEARCH_API_KEY?.trim() || undefined;
  if (provider === "brave") return env.BRAVE_SEARCH_API_KEY?.trim() || undefined;
  return undefined;
}

async function searchAddressBrave(
  address: string,
  apiKey: string,
  step: string,
): Promise<SearchRecord> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", address);
  url.searchParams.set("count", "10");

  const res = await loggedFetch(
    step,
    "brave",
    "web.search",
    url.toString(),
    {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    },
    SEARCH_FETCH_TIMEOUT_MS,
  );
  if (!res.ok) {
    return { results: 0, status: `http_${res.status}` };
  }
  const json = braveResponseSchema.parse(await res.json());
  return { results: json.web?.results?.length ?? 0 };
}

async function searchAddressSerper(
  address: string,
  apiKey: string,
  step: string,
): Promise<SearchRecord> {
  const res = await loggedFetch(
    step,
    "serper",
    "search",
    "https://google.serper.dev/search",
    {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: address, num: 10 }),
    },
    SEARCH_FETCH_TIMEOUT_MS,
  );
  if (!res.ok) {
    return { results: 0, status: `http_${res.status}` };
  }
  const json = serperResponseSchema.parse(await res.json());
  return { results: json.organic?.length ?? 0 };
}

export async function searchAddress(
  address: string,
  apiKey: string,
  step: string,
): Promise<SearchRecord> {
  const provider = activeSearchProvider();
  if (!provider) {
    return { results: 0, status: "search_disabled" };
  }

  try {
    if (provider === "serper") return await searchAddressSerper(address, apiKey, step);
    return await searchAddressBrave(address, apiKey, step);
  } catch (e) {
    return {
      results: 0,
      status: e instanceof Error ? e.message : "search_failed",
    };
  }
}

export function formatSearchCsvEntry(address: string, record: SearchRecord): string {
  const suffix =
    record.results === 0 && record.status === "http_429" ? " [rate limit]" : "";
  return `search:${address} results:${record.results}${suffix}`;
}
