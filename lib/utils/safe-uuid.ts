// crypto.randomUUID() requires a secure context (https / localhost) and is
// missing in some browser configurations / older WebViews. Wrap it with an
// RFC4122 v4 Math.random fallback so client-side ID generation never throws.
// IDs from the fallback are NOT cryptographically random — only use this for
// non-security identifiers (event ids, timer ids, etc.).
export function safeUuid(): string {
  const c = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      // fall through to the math-random path
    }
  }
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
