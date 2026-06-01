const ZERO = "0x" + "0".repeat(40);

/** Walk 32-byte words after the 4-byte selector; extract right-padded addresses. */
export function extractCalldataAddresses(input: string): string[] {
  const hex = input.startsWith("0x") ? input.slice(2) : input;
  if (hex.length < 8) return [];
  const body = hex.slice(8);
  const out: string[] = [];
  for (let i = 0; i + 64 <= body.length; i += 64) {
    const word = body.slice(i, i + 64);
    const addr = ("0x" + word.slice(24)).toLowerCase();
    // Keep only valid 20-byte addresses (40 hex chars), skip zero and malformed words.
    if (/^0x[0-9a-f]{40}$/.test(addr) && addr !== ZERO) {
      out.push(addr);
    }
  }
  return [...new Set(out)];
}
