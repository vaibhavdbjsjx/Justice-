/**
 * Validates a post-auth return path (?next=). Only same-origin absolute
 * paths pass — anything else (external URLs, protocol-relative "//",
 * schemes) falls back to undefined so auth flows use their defaults.
 */
export function safeNextPath(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return undefined;
  }
  return raw;
}
