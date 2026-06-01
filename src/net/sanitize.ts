/** Redact secrets before logging URLs. */
export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has("apikey")) u.searchParams.set("apikey", "***");
    return u.toString();
  } catch {
    return url.replace(/apikey=[^&]+/gi, "apikey=***");
  }
}

export function truncateDetail(detail: string, max = 160): string {
  const oneLine = detail.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
}
